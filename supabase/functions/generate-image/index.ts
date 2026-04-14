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
import { UserProviderService } from '../_shared/services/user-provider.ts';
import { UserConfiguredImageProvider } from '../_shared/providers/user-configured-provider.ts';
import { OpenAICompatibleClient } from '../_shared/providers/openai-client.ts';
import { validateProviderHostAsync, sanitizeErrorMessage } from '../_shared/security/provider-host-allowlist.ts';
import { createLogger } from '../_shared/observability/logger.ts';
import { trackMetric } from '../_shared/observability/metrics.ts';
import { isModelConfigEnabled } from '../_shared/observability/feature-flags.ts';
import {
  executeSharedImageGeneration,
  resolveSystemImageGenerationProvider,
} from '../_shared/utils/image-generation-core.ts';
import { validateTrustedProjectReferenceImageUrl } from '../_shared/utils/trusted-reference-image.ts';
import type { ImageGenerateRequest, ImageGenerateResponse, ResolutionPreset, AspectRatio } from '../_shared/types/index.ts';
import type { ImageProvider } from '../_shared/providers/types.ts';
import { resolveDefaultModel } from '../_shared/utils/resolve-default-model.ts';
import { DEFAULT_IMAGE_MODEL } from '../_shared/defaults.ts';

const log = createLogger('generate-image');

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
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
    const requestId = crypto.randomUUID();

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

    // Resolve default image model from system_settings → hardcoded constant
    const resolvedDefault = await resolveDefaultModel(supabaseService, 'default_image_model', DEFAULT_IMAGE_MODEL);
    const selectedModel = request.model || resolvedDefault!;

    log.info('Starting generation', { request_id: requestId, model_name: selectedModel });

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

    await validateTrustedProjectReferenceImageUrl(
      supabaseService,
      request.projectId,
      request.imageUrl,
    );

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
      const config = await userProviderService.getConfigById(user.id, configId, 'image');

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
      const resolved = resolveSystemImageGenerationProvider({
        selectedModel,
        defaultModel: DEFAULT_IMAGE_MODEL,
        registry,
      });
      if (resolved.fallbackApplied) {
        log.info('Model not registered, falling back', { model_name: selectedModel, fallback: DEFAULT_IMAGE_MODEL, request_id: requestId });
      }
      provider = resolved.provider;
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
      
      const aspectRatio = request.aspectRatio || '1:1';
      const sharedResult = await executeSharedImageGeneration({
        provider,
        prompt: request.prompt,
        selectedModel,
        resolution,
        aspectRatio: aspectRatio as AspectRatio,
        userId: user.id,
        projectId: request.projectId,
        assetService,
        imageUrl: request.imageUrl,
        placeholderX: request.placeholderX,
        placeholderY: request.placeholderY,
        compressThresholdBytes: getIntEnv(
          'GEMINI_REFERENCE_COMPRESS_THRESHOLD_BYTES',
          DEFAULT_REFERENCE_COMPRESS_THRESHOLD_BYTES
        ),
      });

      if (sharedResult.kind === 'text-only') {
        await jobService.updateStatus(job.id, 'done', sharedResult.output);
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

      console.log(`[generate-image] Asset created: ${sharedResult.asset.id}`);

      // NOTE: We intentionally do NOT save the op here.
      // The op is included in job output and will be:
      // 1. Executed by handleJobDone on the client that initiated the request
      // 2. Saved to ops table by the client if position changed (user dragged placeholder)
      // This prevents duplicate execution via Realtime subscription.

      await jobService.updateStatus(job.id, 'done', sharedResult.jobOutput);
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

      // Update job to failed — sanitize error message for user providers
      // Requirements: 5.5, 8.1
      const rawMessage = providerError instanceof Error ? providerError.message : 'Image generation failed';
      const errorMessage = isUserModel ? sanitizeErrorMessage(rawMessage) : rawMessage;
      await jobService.updateStatus(job.id, 'failed', undefined, errorMessage);

      // Refund points for system models on generation failure
      if (!isUserModel && pointsDeducted > 0) {
        await pointsService.refundPoints(
          user.id,
          pointsDeducted,
          'generate_image',
          selectedModel,
          'Refund for failed image generation'
        );
        log.info('Refunded points after generation failure', { user_id: user.id, points_refunded: pointsDeducted, request_id: requestId });
      }

      throw providerError;
    }

  } catch (error) {
    console.error('[generate-image] Error:', error);
    return errorToResponse(error, corsHeaders);
  }
});
