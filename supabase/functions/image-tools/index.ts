/**
 * Image Tools Edge Function
 * Handles AI image editing requests (remove background, upscale, erase, expand)
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { errorToResponse, AuthError, ValidationError, InsufficientPointsError } from '../_shared/errors/index.ts';
import { JobService } from '../_shared/services/job.ts';
import { AssetService } from '../_shared/services/asset.ts';
import { PointsService } from '../_shared/services/points.ts';
import { OpsService } from '../_shared/services/ops.ts';
import { ProviderFactory } from '../_shared/providers/factory.ts';
import type { AspectRatio, ResolutionPreset } from '../_shared/providers/types.ts';
import type { ImageToolRequest, ImageToolResponse, ImageToolJobOutput } from '../_shared/types/index.ts';
import { resolveDefaultModel } from '../_shared/utils/resolve-default-model.ts';
import { DEFAULT_IMAGE_MODEL } from '../_shared/defaults.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function resolveImageToolModel(supabaseService: ReturnType<typeof createClient>): Promise<string> {
  // Priority: ai_models table (supports_image_tool) → system_settings → hardcoded constant
  const { data, error } = await supabaseService
    .from('ai_models')
    .select('name, sort_order')
    .eq('is_enabled', true)
    .eq('supports_image_tool', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[image-tools] Failed to fetch image tool model:', error.message);
    return (await resolveDefaultModel(supabaseService, 'default_image_model', DEFAULT_IMAGE_MODEL))!;
  }

  if (data?.name) return data.name;

  return (await resolveDefaultModel(supabaseService, 'default_image_model', DEFAULT_IMAGE_MODEL))!;
}


function validateRequest(body: unknown): { valid: true; data: ImageToolRequest } | { valid: false; errors: string[] } {
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
  if (typeof b.tool !== 'string' || !b.tool) {
    errors.push('tool is required');
  }
  if (typeof b.imageUrl !== 'string' || !b.imageUrl) {
    errors.push('imageUrl is required');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      projectId: b.projectId as string,
      documentId: b.documentId as string,
      tool: b.tool as ImageToolRequest['tool'],
      imageUrl: b.imageUrl as string,
      targetX: typeof b.targetX === 'number' ? b.targetX : undefined,
      targetY: typeof b.targetY === 'number' ? b.targetY : undefined,
      model: typeof b.model === 'string' ? b.model : undefined,
      params: (b.params as Record<string, unknown>) || undefined,
      source: (b.source as ImageToolRequest['source']) || undefined,
    },
  };
}



async function fetchReferenceImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[image-tools] Failed to fetch reference image: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = response.headers.get('content-type') || 'image/png';
    return { base64, mimeType };
  } catch (error) {
    console.warn('[image-tools] Error fetching reference image:', error);
    return null;
  }
}

function validateToolParams(_tool: ImageToolRequest['tool'], _params?: Record<string, unknown>): void {
  return;
}

function getResolution(params?: Record<string, unknown>): ResolutionPreset | undefined {
  const value = params?.resolution;
  return typeof value === 'string' ? value as ResolutionPreset : undefined;
}


async function fetchToolPrompt(
  supabaseService: ReturnType<typeof createClient>,
  projectId: string,
  tool: ImageToolRequest['tool']
): Promise<string | null> {
  const { data, error } = await supabaseService
    .from('image_tool_prompts')
    .select('prompt')
    .eq('project_id', projectId)
    .eq('tool', tool)
    .eq('is_enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[image-tools] Failed to fetch tool prompt:', error.message);
    return null;
  }

  return data?.prompt || null;
}

function getAspectRatio(params?: Record<string, unknown>): AspectRatio | undefined {
  const value = params?.aspectRatio;
  return typeof value === 'string' ? value as AspectRatio : undefined;
}


function getPrompt(tool: ImageToolRequest['tool'], params?: Record<string, unknown>, override?: string | null): string {
  const paramPrompt = params?.prompt;
  if (override && override.trim()) {
    return override;
  }
  if (typeof paramPrompt === 'string' && paramPrompt.trim()) {
    return paramPrompt;
  }

  switch (tool) {
    case 'removeBackground':
      return 'Remove the background and preserve the main subject.';
    case 'upscale':
      return 'Upscale the image while preserving details.';
    case 'erase':
      return 'Erase the masked region and fill it naturally.';
    case 'expand':
      return 'Expand the image beyond its borders with coherent content.';
    default:
      return `image tool: ${tool}`;
  }
}

async function runProviderTool(
  supabaseService: ReturnType<typeof createClient>,
  selectedModel: string,
  request: ImageToolRequest
): Promise<{ imageData: ArrayBuffer; mimeType: string; width?: number; height?: number }>{
  validateToolParams(request.tool, request.params);

  const providerFactory = new ProviderFactory(supabaseService);
  const provider = providerFactory.getProviderOrDefault(selectedModel);

  const referenceImage = request.imageUrl
    ? await fetchReferenceImage(request.imageUrl)
    : null;

  const toolPrompt = await fetchToolPrompt(supabaseService, request.projectId, request.tool);

  const result = await provider.generate({
    prompt: getPrompt(request.tool, request.params, toolPrompt),
    aspectRatio: getAspectRatio(request.params),
    resolution: getResolution(request.params) || '1K',
    referenceImageBase64: referenceImage?.base64,
    referenceImageMimeType: referenceImage?.mimeType,
  });

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', ['Only POST method is supported']);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthError('Missing authorization header', 'MISSING_AUTH');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      throw new ValidationError('Invalid request', validation.errors);
    }

    const request = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const selectedModel = request.model || await resolveImageToolModel(supabaseService);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthError('Invalid authorization', 'INVALID_AUTH');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', request.projectId)
      .single();

    if (projectError || !project) {
      throw new AuthError('Project not found or access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const pointsService = new PointsService(supabaseService);
    const jobService = new JobService(supabaseService);
    const assetService = new AssetService(supabaseService, supabaseUrl);
    const opsService = new OpsService(supabaseService);

    const pointsCost = await pointsService.calculateCost(selectedModel, '1K');

    let deductResult;
    try {
      deductResult = await pointsService.deductPoints(
        user.id,
        pointsCost,
        'image_tools',
        selectedModel
      );
    } catch (error) {
      if (error instanceof InsufficientPointsError) {
        throw error;
      }
      throw error;
    }

    const job = await jobService.createJob(
      'image-tool',
      {
        tool: request.tool,
        imageUrl: request.imageUrl,
        model: selectedModel,
        params: request.params,
        source: request.source,
      },
      user.id,
      request.projectId,
      request.documentId
    );

    await jobService.updateStatus(job.id, 'processing');

    try {
      const { imageData, mimeType, width, height } = await runProviderTool(supabaseService, selectedModel, request);

      const asset = await assetService.uploadImage(
        user.id,
        request.projectId,
        imageData,
        mimeType,
        {
          model: selectedModel,
          prompt: `${request.tool}-tool`,
          source: {
            type: 'canvas_tool',
            origin: request.tool,
          },
        }
      );

      const layerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
      const addImageOp = {
        type: 'addImage',
        payload: {
          id: layerId,
          src: asset.publicUrl,
          x: request.targetX ?? 100,
          y: request.targetY ?? 100,
          width: width ?? asset.dimensions?.width ?? 1024,
          height: height ?? asset.dimensions?.height ?? 1024,
        },
      };

      try {
        await opsService.saveOp(request.documentId, addImageOp);
      } catch (opsSaveError) {
        console.error('[image-tools] Failed to save op to ops table:', opsSaveError);
      }

      const jobOutput: ImageToolJobOutput = {
        assetId: asset.id,
        storagePath: asset.storagePath,
        publicUrl: asset.publicUrl,
        layerId,
        op: addImageOp,
        model: selectedModel,
        tool: request.tool,
      };

      await jobService.updateStatus(job.id, 'done', jobOutput);

      const responseBody: ImageToolResponse = {
        jobId: job.id,
        pointsDeducted: deductResult.pointsDeducted,
        remainingPoints: deductResult.balanceAfter,
        modelUsed: selectedModel,
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (providerError) {
      const errorMessage = providerError instanceof Error ? providerError.message : 'Image tool processing failed';
      await jobService.updateStatus(job.id, 'failed', undefined, errorMessage);
      throw providerError;
    }
  } catch (error) {
    console.error('[image-tools] Error:', error);
    return errorToResponse(error, corsHeaders);
  }
});
