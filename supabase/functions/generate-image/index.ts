/**
 * Generate Image Edge Function
 * Handles AI image generation requests with multiple provider support
 * Requirements: 1.1-1.8, 2.1-2.6, 3.1-3.8, 4.1-4.6, 5.1-5.6, 6.1-6.6
 *
 * POST /functions/v1/generate-image
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { errorToResponse, AuthError, ValidationError, InsufficientPointsError } from '../_shared/errors/index.ts';
import { JobService } from '../_shared/services/job.ts';
import { AssetService } from '../_shared/services/asset.ts';
import { PointsService } from '../_shared/services/points.ts';
import { GeminiProvider, calculateDimensions } from '../_shared/providers/gemini.ts';
import { VolcengineProvider } from '../_shared/providers/volcengine.ts';
import { isGeminiModel, isVolcengineModel } from '../_shared/providers/types.ts';
import type { ImageGenerateRequest, ImageGenerateResponse, ResolutionPreset, AspectRatio } from '../_shared/types/index.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default model
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

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
async function fetchReferenceImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[generate-image] Failed to fetch reference image: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = response.headers.get('content-type') || 'image/png';
    return { base64, mimeType };
  } catch (error) {
    console.warn(`[generate-image] Error fetching reference image:`, error);
    return null;
  }
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

    console.log(`[generate-image] Starting generation with model: ${selectedModel}`);

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
    const pointsService = new PointsService(supabaseService);
    const jobService = new JobService(supabaseService);
    const assetService = new AssetService(supabaseService, supabaseUrl);

    // Calculate points cost
    const resolution = request.resolution || '1K';
    const pointsCost = await pointsService.calculateCost(selectedModel, resolution);

    console.log(`[generate-image] Points cost: ${pointsCost} for model ${selectedModel}, resolution ${resolution}`);

    // Deduct points before processing
    let deductResult;
    try {
      deductResult = await pointsService.deductPoints(
        user.id,
        pointsCost,
        'generate_image',
        selectedModel
      );
    } catch (error) {
      if (error instanceof InsufficientPointsError) {
        throw error;
      }
      throw error;
    }

    console.log(`[generate-image] Points deducted: ${deductResult.pointsDeducted}, remaining: ${deductResult.balanceAfter}`);

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
      },
      user.id,
      request.projectId,
      request.documentId
    );

    console.log(`[generate-image] Job created: ${job.id}`);

    // Update job to processing
    await jobService.updateStatus(job.id, 'processing');

    // Process generation asynchronously but wait for result
    // This is synchronous in the Edge Function for simplicity
    try {
      console.log(`[generate-image] ========== GENERATION START ==========`);
      console.log(`[generate-image] Selected Model: ${selectedModel}`);
      console.log(`[generate-image] Prompt: ${request.prompt}`);
      console.log(`[generate-image] Resolution: ${resolution}`);
      console.log(`[generate-image] Aspect Ratio: ${request.aspectRatio || '1:1'}`);
      console.log(`[generate-image] Has Image URL: ${!!request.imageUrl}`);
      
      // Fetch reference image if provided
      let referenceImage: { base64: string; mimeType: string } | null = null;
      if (request.imageUrl) {
        console.log(`[generate-image] Fetching reference image from: ${request.imageUrl}`);
        referenceImage = await fetchReferenceImage(request.imageUrl);
        if (referenceImage) {
          console.log(`[generate-image] Reference image fetched: ${referenceImage.mimeType}, base64 length: ${referenceImage.base64.length}`);
        } else {
          console.warn(`[generate-image] Failed to fetch reference image`);
        }
      }

      // Select and create provider
      let imageResult;
      const aspectRatio = request.aspectRatio || '1:1';

      if (isGeminiModel(selectedModel)) {
        console.log(`[generate-image] Using Gemini provider`);
        const provider = new GeminiProvider(supabaseService, selectedModel);
        imageResult = await provider.generate({
          prompt: request.prompt,
          aspectRatio,
          resolution,
          referenceImageBase64: referenceImage?.base64,
          referenceImageMimeType: referenceImage?.mimeType,
        });
      } else if (isVolcengineModel(selectedModel)) {
        console.log(`[generate-image] Using Volcengine provider`);
        const provider = new VolcengineProvider(selectedModel);
        imageResult = await provider.generate({
          prompt: request.prompt,
          referenceImageBase64: referenceImage?.base64,
          referenceImageMimeType: referenceImage?.mimeType,
        });
      } else {
        console.log(`[generate-image] Unknown model, defaulting to Gemini flash`);
        const provider = new GeminiProvider(supabaseService, 'gemini-2.5-flash-image');
        imageResult = await provider.generate({
          prompt: request.prompt,
          aspectRatio,
          resolution,
          referenceImageBase64: referenceImage?.base64,
          referenceImageMimeType: referenceImage?.mimeType,
        });
      }

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

      // Build job output
      const jobOutput = {
        assetId: asset.id,
        storagePath: asset.storagePath,
        publicUrl: asset.publicUrl,
        layerId,
        op: {
          type: 'addImage',
          payload: {
            id: layerId,
            src: asset.publicUrl,
            x: request.placeholderX || 100,
            y: request.placeholderY || 100,
            width: imageResult.width || dimensions.width,
            height: imageResult.height || dimensions.height,
          },
        },
        model: selectedModel,
        resolution,
        aspectRatio,
      };

      // Update job to done
      await jobService.updateStatus(job.id, 'done', jobOutput);

      console.log(`[generate-image] Job completed: ${job.id}`);

      // Return success response
      const response: ImageGenerateResponse = {
        jobId: job.id,
        pointsDeducted: deductResult.pointsDeducted,
        remainingPoints: deductResult.balanceAfter,
        modelUsed: selectedModel,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (providerError) {
      console.error(`[generate-image] Provider error:`, providerError);
      
      // Update job to failed
      const errorMessage = providerError instanceof Error ? providerError.message : 'Image generation failed';
      await jobService.updateStatus(job.id, 'failed', undefined, errorMessage);
      
      throw providerError;
    }

  } catch (error) {
    console.error('[generate-image] Error:', error);
    return errorToResponse(error, corsHeaders);
  }
});
