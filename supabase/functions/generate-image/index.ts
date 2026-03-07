/**
 * Generate Image Edge Function
 * Handles AI image generation requests with multiple provider support
 * Requirements: 1.1-1.8, 2.1-2.6, 3.1-3.8, 4.1-4.6, 5.1-5.6, 6.1-6.6
 *
 * POST /functions/v1/generate-image
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import {
  errorToResponse,
  AuthError,
  ValidationError,
  ProviderError,
  UserProviderConfigInvalidError,
} from '../_shared/errors/index.ts';
import { JobService } from '../_shared/services/job.ts';
import { AssetService } from '../_shared/services/asset.ts';
import { PointsService } from '../_shared/services/points.ts';
import { createRegistry } from '../_shared/providers/registry-setup.ts';
import { calculateDimensions } from '../_shared/providers/gemini.ts';
import { fetchReferenceImageForGemini } from '../_shared/utils/reference-image.ts';
import { UserProviderService } from '../_shared/services/user-provider.ts';
import { UserConfiguredImageProvider } from '../_shared/providers/user-configured-provider.ts';
import { OpenAICompatibleClient } from '../_shared/providers/openai-client.ts';
import { validateProviderHostAsync, sanitizeErrorMessage } from '../_shared/security/provider-host-allowlist.ts';
import { createLogger } from '../_shared/observability/logger.ts';
import { trackMetric } from '../_shared/observability/metrics.ts';
import { isModelConfigEnabled } from '../_shared/observability/feature-flags.ts';
import type { ImageGenerateRequest, ImageGenerateResponse, ResolutionPreset, AspectRatio } from '../_shared/types/index.ts';
import type { ImageProvider } from '../_shared/providers/types.ts';

const log = createLogger('generate-image');

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default model
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_REFERENCE_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2MB

// ============================================================================
// User Model Identifier Helpers
// Requirements: 5.1
// ============================================================================

function isUserModelIdentifier(model: string): model is `user:${string}` {
  return model.startsWith('user:');
}

function getUserConfigId(model: `user:${string}`): string {
  return model.slice('user:'.length);
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: ImageGenerateRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.projectId !== 'string' || !b.projectId) {
    errors.push('projectId is required');
  }
  if (typeof b.documentId !== 'string' || !b.documentId) {
    errors.push('documentId is required');
  }
  if (typeof b.prompt !== 'string' || !b.prompt.trim()) {
    errors.push('prompt is required');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      projectId: b.projectId as string,
      documentId: b.documentId as string,
      prompt: b.prompt as string,
      model: typeof b.model === 'string' ? b.model : undefined,
      width: typeof b.width === 'number' ? b.width : undefined,
      height: typeof b.height === 'number' ? b.height : undefined,
      conversationId: typeof b.conversationId === 'string' ? b.conversationId : undefined,
      imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : undefined,
      placeholderX: typeof b.placeholderX === 'number' ? b.placeholderX : 100,
      placeholderY: typeof b.placeholderY === 'number' ? b.placeholderY : 100,
      aspectRatio: typeof b.aspectRatio === 'string' ? b.aspectRatio as AspectRatio : undefined,
      resolution: typeof b.resolution === 'string' ? b.resolution as ResolutionPreset : undefined,
    },
  };
}

/**
 * Fetch reference image and convert to base64
 */
function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  // Avoid spreading large Uint8Arrays into fromCharCode (argument limit / stack overflow).
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', ['Only POST method is supported']);
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthError('Missing authorization header', 'MISSING_AUTH');
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      throw new ValidationError('Invalid request', validation.errors);
    }

    const request = validation.data;
    const selectedModel = request.model || DEFAULT_MODEL;
    const requestId = crypto.randomUUID();

    log.info('Starting generation', { request_id: requestId, model_name: selectedModel });

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client with auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Service client for bypassing RLS (points, assets)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthError('Invalid authorization', 'INVALID_AUTH');
    }

    // Verify project access (RLS handles this)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', request.projectId)
      .single();

    if (projectError || !project) {
      throw new AuthError('Project not found or access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    // Initialize services
    const jobService = new JobService(supabaseService);
    const assetService = new AssetService(supabaseService, supabaseUrl);
    const pointsService = new PointsService(supabaseService);

    // ========================================================================
    // Route: user model (BYOK) vs system model
    // Requirements: 5.1-5.4, 5.6
    // ========================================================================
    const isUserModel = isUserModelIdentifier(selectedModel);
    const resolution = request.resolution || '1K';
    let userConfigId: string | null = null;

    // Feature flag gate: reject user model routes when feature is disabled
    // Requirements: 8.4
    if (isUserModel) {
      const enabled = await isModelConfigEnabled(supabaseService);
      if (!enabled) {
        log.warn('Feature disabled, rejecting user model', { user_id: user.id, model_name: selectedModel, request_id: requestId });
        throw new ProviderError(
          'Custom provider configuration is currently disabled. Please try again later.',
          'FEATURE_DISABLED',
          undefined,
          'user-configured',
          selectedModel,
          503
        );
      }
    }

    let pointsDeducted = 0;
    let remainingPoints = 0;
    let provider: ImageProvider;

    if (isUserModel) {
      // --- User BYOK path ---
      const configId = getUserConfigId(selectedModel as `user:${string}`);
      userConfigId = configId;
      log.info('User model detected', { user_id: user.id, config_id: configId, request_id: requestId });

      const encryptionSecret = Deno.env.get('PROVIDER_ENCRYPTION_SECRET');
      if (!encryptionSecret) {
        throw new ProviderError(
          'Server configuration error: encryption secret not available',
          'CONFIG_ERROR',
          undefined,
          'user-configured'
        );
      }

      const userProviderService = new UserProviderService(supabaseService, encryptionSecret);
      const config = await userProviderService.getConfigById(user.id, configId);

      if (!config) {
        // Write failed job for audit, then return structured error (NO auto-fallback)
        // Requirements: 5.3
        const auditJob = await jobService.createJob(
          'generate-image',
          {
            prompt: request.prompt,
            model: selectedModel,
            resolution,
            aspectRatio: request.aspectRatio || '1:1',
          },
          user.id,
          request.projectId,
          request.documentId
        );
        await jobService.updateStatus(
          auditJob.id,
          'failed',
          undefined,
          `USER_PROVIDER_CONFIG_INVALID: configId=${configId}`
        );
        console.warn(`[generate-image] User config not found/disabled: configId=${configId}, userId=${user.id}, auditJobId=${auditJob.id}`);
        trackMetric({ event: 'byok_generation_failure', user_id: user.id, config_id: configId, reason: 'config_not_found' });
        throw new UserProviderConfigInvalidError(
          'Provider configuration not found or disabled. Please check your settings.',
          { configId },
        );
      }

      // Allowlist re-validation before making external request
      // Requirements: 5.5, 5.7
      const hostCheck = await validateProviderHostAsync(config.api_url, { serviceClient: supabaseService });
      if (!hostCheck.valid) {
        const auditJob = await jobService.createJob(
          'generate-image',
          {
            prompt: request.prompt,
            model: selectedModel,
            resolution,
            aspectRatio: request.aspectRatio || '1:1',
          },
          user.id,
          request.projectId,
          request.documentId
        );
        await jobService.updateStatus(
          auditJob.id,
          'failed',
          undefined,
          `Host allowlist check failed: ${hostCheck.reason}`
        );
        console.warn(`[generate-image] Host allowlist rejected: url=${config.api_url}, reason=${hostCheck.reason}`);
        if (hostCheck.code === 'ALLOWLIST_EMPTY') {
          log.error('Fail-closed triggered: allowlist unavailable', {
            user_id: user.id,
            request_id: requestId,
            config_id: configId,
          });
          trackMetric({
            event: 'allowlist_fail_closed',
            user_id: user.id,
            config_id: configId,
          });
        }
        trackMetric({ event: 'byok_generation_failure', user_id: user.id, config_id: configId, reason: 'host_not_allowed' });
        throw new ProviderError(
          `Provider endpoint not allowed: ${hostCheck.reason}`,
          hostCheck.code === 'ALLOWLIST_EMPTY' ? 'ALLOWLIST_UNAVAILABLE' : 'CONFIG_ERROR',
          undefined,
          'user-configured',
          selectedModel,
          hostCheck.code === 'ALLOWLIST_EMPTY' ? 503 : 403
        );
      }

      const client = new OpenAICompatibleClient({
        apiUrl: config.api_url,
        apiKey: config.api_key,
        providerName: `user-configured:${config.provider}`,
      });
      provider = new UserConfiguredImageProvider(client, config);

      // BYOK: skip points entirely — no calculateCost, no deductPoints, no transaction
      // Requirements: 5.6
      pointsDeducted = 0;
      remainingPoints = await pointsService.getCurrentBalance(user.id);
      log.info('BYOK path: skipping points deduction', { user_id: user.id, config_id: configId, request_id: requestId });

    } else {
      // --- System model path (existing flow) ---
      const pointsCost = await pointsService.calculateCost(selectedModel, resolution);
      log.info('Points cost calculated', { user_id: user.id, model_name: selectedModel, resolution, points_cost: pointsCost, request_id: requestId });

      const deductResult = await pointsService.deductPoints(
        user.id,
        pointsCost,
        'generate_image',
        selectedModel
      );
      pointsDeducted = deductResult.pointsDeducted;
      remainingPoints = deductResult.balanceAfter;
      log.info('Points deducted', { user_id: user.id, model_name: selectedModel, points_deducted: deductResult.pointsDeducted, remaining: deductResult.balanceAfter, request_id: requestId });

      // Resolve from system registry
      const registry = createRegistry(supabaseService);
      let resolvedModel = selectedModel;
      if (!registry.isSupported(selectedModel)) {
        log.info('Model not registered, falling back', { model_name: selectedModel, fallback: DEFAULT_MODEL, request_id: requestId });
        resolvedModel = DEFAULT_MODEL;
      }
      provider = registry.getImageProvider(resolvedModel);
    }

    log.info('Using provider', { provider: provider.name, request_id: requestId });

    // Create job record
    const job = await jobService.createJob(
      'generate-image',
      {
        prompt: request.prompt,
        model: selectedModel,
        resolution,
        aspectRatio: request.aspectRatio || '1:1',
        imageUrl: request.imageUrl,
        placeholderX: request.placeholderX,
        placeholderY: request.placeholderY,
        isUserModel,
      },
      user.id,
      request.projectId,
      request.documentId
    );

    log.info('Job created', { job_id: job.id, request_id: requestId });

    // Update job to processing
    await jobService.updateStatus(job.id, 'processing');

    // Process generation asynchronously but wait for result
    // This is synchronous in the Edge Function for simplicity
    try {
      log.info('Generation start', {
        request_id: requestId,
        user_id: user.id,
        model_name: selectedModel,
        resolution,
        aspect_ratio: request.aspectRatio || '1:1',
        has_image_url: !!request.imageUrl,
      });
      
      // Fetch and optionally compress reference image if provided
      let referenceImage: { base64: string; mimeType: string; sizeBytes: number; strategy: string } | null = null;
      if (request.imageUrl) {
        const compressThresholdBytes = getIntEnv(
          'GEMINI_REFERENCE_COMPRESS_THRESHOLD_BYTES',
          DEFAULT_REFERENCE_COMPRESS_THRESHOLD_BYTES
        );
        log.info('Fetching reference image', { request_id: requestId });
        const preparedReference = await fetchReferenceImageForGemini(request.imageUrl, {
          compressThresholdBytes,
        });

        if (preparedReference) {
          const base64 = arrayBufferToBase64(preparedReference.arrayBuffer);
          referenceImage = {
            base64,
            mimeType: preparedReference.mimeType,
            sizeBytes: preparedReference.sizeBytes,
            strategy: preparedReference.strategy,
          };
          log.info('Reference image ready', {
            request_id: requestId,
            mime: referenceImage.mimeType,
            size_bytes: referenceImage.sizeBytes,
            strategy: referenceImage.strategy,
          });
        } else {
          log.warn('Failed to fetch reference image', { request_id: requestId });
        }
      }

      // Use the provider resolved above (system or user-configured)
      const aspectRatio = request.aspectRatio || '1:1';

      const imageResult = await provider.generate({
        prompt: request.prompt,
        aspectRatio,
        resolution,
        referenceImageBase64: referenceImage?.base64,
        referenceImageMimeType: referenceImage?.mimeType,
      });

      const providerTextResponse =
        typeof imageResult.metadata?.textResponse === 'string'
          ? imageResult.metadata.textResponse
          : undefined;
      const providerThoughtSummary =
        typeof imageResult.metadata?.thoughtSummary === 'string'
          ? imageResult.metadata.thoughtSummary
          : undefined;

      console.log(`[generate-image] ========== GENERATION SUCCESS ==========`);
      console.log(`[generate-image] Image size: ${imageResult.imageData.byteLength} bytes`);
      console.log(`[generate-image] MIME type: ${imageResult.mimeType}`);
      console.log(`[generate-image] Dimensions: ${imageResult.width}x${imageResult.height}`);
      console.log(`[generate-image] Metadata:`, JSON.stringify(imageResult.metadata, null, 2));

      // Upload image to storage
      const asset = await assetService.uploadImage(
        user.id,
        request.projectId,
        imageResult.imageData,
        imageResult.mimeType,
        {
          model: selectedModel,
          prompt: request.prompt,
          resolution,
          aspectRatio,
        }
      );

      console.log(`[generate-image] Asset created: ${asset.id}`);

      // Calculate dimensions for canvas op
      const dimensions = calculateDimensions(resolution as ResolutionPreset, aspectRatio as AspectRatio);
      const layerId = `layer-${crypto.randomUUID().slice(0, 8)}`;

      // Build the addImage op
      const addImageOp = {
        type: 'addImage',
        payload: {
          id: layerId,
          src: asset.publicUrl,
          x: request.placeholderX || 100,
          y: request.placeholderY || 100,
          width: imageResult.width || dimensions.width,
          height: imageResult.height || dimensions.height,
        },
      };

      // NOTE: We intentionally do NOT save the op here.
      // The op is included in job output and will be:
      // 1. Executed by handleJobDone on the client that initiated the request
      // 2. Saved to ops table by the client if position changed (user dragged placeholder)
      // This prevents duplicate execution via Realtime subscription.

      // Build job output (include op for client-side execution via job subscription)
      const jobOutput = {
        assetId: asset.id,
        storagePath: asset.storagePath,
        publicUrl: asset.publicUrl,
        layerId,
        op: addImageOp,
        model: selectedModel,
        resolution,
        aspectRatio,
        textResponse: providerTextResponse,
        thoughtSummary: providerThoughtSummary,
      };

      // Update job to done
      await jobService.updateStatus(job.id, 'done', jobOutput);
      if (isUserModel && userConfigId) {
        trackMetric({
          event: 'byok_generation_success',
          user_id: user.id,
          config_id: userConfigId,
          model_name: selectedModel,
        });
      }

      console.log(`[generate-image] Job completed: ${job.id}`);

      // Return success response
      const response: ImageGenerateResponse = {
        jobId: job.id,
        pointsDeducted,
        remainingPoints,
        modelUsed: selectedModel,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (providerError) {
      console.error(`[generate-image] Provider error:`, providerError);
      if (isUserModel && userConfigId) {
        trackMetric({
          event: 'byok_generation_failure',
          user_id: user.id,
          config_id: userConfigId,
          reason: providerError instanceof Error ? providerError.name : 'provider_generation_error',
        });
      }

      // Gemini native mode can legitimately return text-only output (no image bytes).
      // Treat this as a completed text response so the chat can render it.
      if (providerError instanceof ProviderError && providerError.providerCode === 'TEXT_ONLY_RESPONSE') {
        const details = (providerError.details as Record<string, unknown> | undefined) || {};
        const textResponse = typeof details.textResponse === 'string'
          ? details.textResponse
          : providerError.message;
        const thoughtSummary = typeof details.thoughtSummary === 'string'
          ? details.thoughtSummary
          : undefined;

        const textOnlyOutput = {
          model: selectedModel,
          resolution,
          aspectRatio: request.aspectRatio || '1:1',
          textResponse,
          thoughtSummary,
          providerCode: providerError.providerCode,
        };

        await jobService.updateStatus(job.id, 'done', textOnlyOutput);
        console.log(`[generate-image] Job completed with text-only response: ${job.id}`);

        const response: ImageGenerateResponse = {
          jobId: job.id,
          pointsDeducted,
          remainingPoints,
          modelUsed: selectedModel,
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Update job to failed — sanitize error message for user providers
      // Requirements: 5.5, 8.1
      const rawMessage = providerError instanceof Error ? providerError.message : 'Image generation failed';
      const errorMessage = isUserModel ? sanitizeErrorMessage(rawMessage) : rawMessage;
      await jobService.updateStatus(job.id, 'failed', undefined, errorMessage);
      
      throw providerError;
    }

  } catch (error) {
    console.error('[generate-image] Error:', error);
    return errorToResponse(error, corsHeaders);
  }
});
