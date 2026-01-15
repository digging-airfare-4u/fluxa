/**
 * Generate Image Edge Function
 * Supports text-to-image and image-to-image generation
 * Providers: Volcengine (doubao), Google Gemini
 * Requirements: 1.1-1.8, 2.1-2.7, 3.1-3.8, 4.1-4.4, 5.1-5.8
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import {
  generateImageGemini,
  calculateGeminiPointsCost,
  GEMINI_MODELS,
  RESOLUTION_PRESETS,
  SUPPORTED_ASPECT_RATIOS,
  type GeminiModelName,
  type ResolutionPreset,
  type AspectRatio,
} from '../_shared/gemini-provider.ts';
import {
  getConversationContext,
  updateConversationContext,
  getLastGeneratedImageAsBase64,
  type ConversationContext,
} from '../_shared/conversation-context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  IMAGE_ERROR: 'IMAGE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  RESOLUTION_NOT_ALLOWED: 'RESOLUTION_NOT_ALLOWED',
  MODEL_RESOLUTION_MISMATCH: 'MODEL_RESOLUTION_MISMATCH',
} as const;

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

interface RequestBody {
  projectId: string;
  documentId: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  conversationId?: string;
  imageUrl?: string;
  placeholderX?: number;
  placeholderY?: number;
  // Gemini-specific parameters
  aspectRatio?: AspectRatio;
  resolution?: ResolutionPreset;
}

interface Job {
  id: string;
  project_id: string;
  document_id: string;
  user_id: string;
  type: string;
  status: JobStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * Points deduction result from RPC
 */
interface DeductPointsResult {
  success: boolean;
  points_deducted: number;
  balance_after: number;
  transaction_id: string;
}

/**
 * Insufficient points error details
 */
interface InsufficientPointsError {
  code: 'INSUFFICIENT_POINTS';
  current_balance: number;
  required_points: number;
  model_name: string;
}

/**
 * Check if model is a Gemini model
 */
function isGeminiModel(model: string): model is GeminiModelName {
  return model in GEMINI_MODELS;
}

/**
 * Get user's max allowed resolution from membership
 * Requirements: 3.2, 3.3, 3.4
 */
async function getUserMaxResolution(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ResolutionPreset> {
  const { data, error } = await supabase
    .from('memberships')
    .select('level, membership_configs!inner(perks)')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Default to free tier
    return '1K';
  }

  const perks = (data.membership_configs as { perks: { max_image_resolution?: string } })?.perks;
  const maxRes = perks?.max_image_resolution as ResolutionPreset | undefined;
  
  return maxRes && maxRes in RESOLUTION_PRESETS ? maxRes : '1K';
}

/**
 * Validate resolution against user's membership level
 * Requirements: 3.5
 */
function validateResolutionPermission(
  requestedResolution: ResolutionPreset,
  maxAllowedResolution: ResolutionPreset
): boolean {
  const requestedPixels = RESOLUTION_PRESETS[requestedResolution];
  const maxPixels = RESOLUTION_PRESETS[maxAllowedResolution];
  return requestedPixels <= maxPixels;
}

function validateRequest(body: unknown): body is RequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.projectId === 'string' &&
    typeof b.documentId === 'string' &&
    typeof b.prompt === 'string' &&
    b.prompt.length > 0
  );
}

function generateLayerId(): string {
  const chars = '0123456789abcdef';
  let result = 'layer-';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Get points cost for a model from database
 * Requirements: 2.2, 2.3
 */
async function getModelPointsCost(
  supabase: ReturnType<typeof createClient>,
  modelName: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_model_points_cost', {
    p_model_name: modelName,
  });

  if (error) {
    console.error('Error getting model points cost:', error);
    // Return default value if RPC fails
    return 30; // Default for image generation models
  }

  return data ?? 30;
}

/**
 * Get model display name from database
 */
async function getModelDisplayName(
  supabase: ReturnType<typeof createClient>,
  modelName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('display_name')
    .eq('name', modelName)
    .single();

  if (error || !data) {
    // Return model name as fallback
    return modelName;
  }

  return data.display_name || modelName;
}

/**
 * Deduct points from user balance
 * Requirements: 2.2, 2.5, 2.6
 */
async function deductPoints(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  source: string,
  referenceId: string | null,
  modelName: string
): Promise<{ success: true; result: DeductPointsResult } | { success: false; error: InsufficientPointsError }> {
  const { data, error } = await supabase.rpc('deduct_points', {
    p_user_id: userId,
    p_amount: amount,
    p_source: source,
    p_reference_id: referenceId,
    p_model_name: modelName,
  });

  if (error) {
    // Check if it's an insufficient points error
    if (error.message?.includes('Insufficient points')) {
      // Parse the error message to extract balance info
      const match = error.message.match(/current_balance=(\d+), required=(\d+)/);
      const currentBalance = match ? parseInt(match[1], 10) : 0;
      const requiredPoints = match ? parseInt(match[2], 10) : amount;

      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          current_balance: currentBalance,
          required_points: requiredPoints,
          model_name: modelName,
        },
      };
    }
    // Re-throw other errors
    throw new Error(`Points deduction failed: ${error.message}`);
  }

  return {
    success: true,
    result: data as DeductPointsResult,
  };
}

async function generateImageVolcengine(
  prompt: string,
  width: number,
  height: number,
  modelName?: string,
  referenceImageUrl?: string
): Promise<{ imageUrl: string }> {
  const apiKey = Deno.env.get('VOLCENGINE_API_KEY');
  if (!apiKey) throw new Error('VOLCENGINE_API_KEY not configured');

  const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
  const model = modelName || Deno.env.get('VOLCENGINE_IMAGE_MODEL') || 'doubao-seedream-4-5-251128';

  let size = '2K';  // 豆包 Seedream 最小需要 1920x1920 (3686400 pixels)

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    size,
    watermark: false,
    sequential_image_generation: 'disabled',
  };

  // Image-to-image: add reference image as array
  if (referenceImageUrl) {
    requestBody.image = [referenceImageUrl];
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Volcengine API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const imageData = data.data?.[0];
  if (!imageData) throw new Error('No image data in response');

  if (imageData.url) return { imageUrl: imageData.url };
  if (imageData.b64_json) return { imageUrl: `data:image/png;base64,${imageData.b64_json}` };
  throw new Error('Invalid response: no url or b64_json');
}

/**
 * Convert base64 image data to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Download and convert reference image to base64 for Gemini
 * Requirements: 1.8
 */
async function getImageAsBase64(
  supabase: ReturnType<typeof createClient>,
  imageUrl: string,
  userId: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // If it's a Supabase storage URL, validate ownership
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    if (imageUrl.includes(supabaseUrl) && imageUrl.includes('/storage/')) {
      // Extract storage path from URL
      const pathMatch = imageUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/assets\/(.+)/);
      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1]);
        // Check if path starts with user's ID (ownership check)
        if (!storagePath.startsWith(userId + '/')) {
          console.warn(`[Gemini] User ${userId} attempted to access image owned by another user`);
          return null;
        }
      }
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[Gemini] Failed to fetch reference image: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { base64, mimeType: contentType };
  } catch (error) {
    console.error('[Gemini] Error fetching reference image:', error);
    return null;
  }
}

async function downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string; width?: number; height?: number }> {
  if (url.startsWith('data:')) {
    const matches = url.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { data: bytes.buffer, contentType };
    }
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/png';
  const data = await response.arrayBuffer();
  return { data, contentType };
}

/**
 * Get image dimensions from ArrayBuffer
 * Supports PNG and JPEG formats
 */
function getImageDimensions(data: ArrayBuffer, contentType: string): { width: number; height: number } | null {
  const bytes = new Uint8Array(data);
  
  // PNG: dimensions at bytes 16-23 (width: 16-19, height: 20-23)
  if (contentType.includes('png') && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }
  
  // JPEG: need to parse markers to find SOF0/SOF2
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    let i = 2; // Skip SOI marker
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xFF) break;
      const marker = bytes[i + 1];
      // SOF0 (0xC0) or SOF2 (0xC2) contain dimensions
      if (marker === 0xC0 || marker === 0xC2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      // Skip to next marker
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + length;
    }
  }
  
  return null;
}

async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: Job,
  userId: string
): Promise<void> {
  const { 
    projectId, 
    documentId, 
    prompt, 
    model, 
    width, 
    height, 
    conversationId, 
    imageUrl: refImage, 
    placeholderX, 
    placeholderY,
    aspectRatio,
    resolution,
  } = job.input as {
    projectId: string;
    documentId: string;
    prompt: string;
    model?: string;
    width: number;
    height: number;
    conversationId?: string;
    imageUrl?: string;
    placeholderX?: number;
    placeholderY?: number;
    aspectRatio?: AspectRatio;
    resolution?: ResolutionPreset;
  };

  try {
    await updateJobStatus(supabase, job.id, 'processing');

    let imageData: ArrayBuffer;
    let contentType: string;
    let imageDimensions: { width: number; height: number } | null = null;
    let usedModel = model || 'doubao-seedream-4-5-251128';

    // Route to appropriate provider based on model
    if (model && isGeminiModel(model)) {
      // Gemini provider
      console.log(`[Gemini] Processing job ${job.id} with model ${model}`);
      
      // =========================================================================
      // Multi-turn conversation context handling
      // Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7
      // =========================================================================
      let referenceImageBase64: string | undefined;
      let referenceImageMimeType: string | undefined;
      let conversationContext: ConversationContext | null = null;
      
      // Load conversation context if conversationId is provided
      // Requirements: 2.1, 2.2
      if (conversationId) {
        conversationContext = await getConversationContext(supabase, conversationId);
        console.log(`[Gemini] Loaded conversation context for ${conversationId}:`, {
          hasLastAsset: !!conversationContext?.lastGeneratedAssetId,
          hasGeminiContext: !!conversationContext?.providerContext?.gemini,
        });
      }
      
      // Priority for reference image:
      // 1. Explicit imageUrl from request (user uploaded/selected image)
      // 2. Last generated image from conversation context (multi-turn editing)
      // Requirements: 2.3, 2.7
      if (refImage) {
        // User provided explicit reference image
        const refImageData = await getImageAsBase64(supabase, refImage, userId);
        if (refImageData) {
          referenceImageBase64 = refImageData.base64;
          referenceImageMimeType = refImageData.mimeType;
          console.log(`[Gemini] Using explicit reference image from request`);
        }
      } else if (conversationContext?.lastGeneratedAssetId) {
        // Use last generated image from conversation for multi-turn editing
        // Requirements: 2.3, 2.7
        const lastImageData = await getLastGeneratedImageAsBase64(
          supabase,
          conversationContext.lastGeneratedAssetId,
          userId
        );
        if (lastImageData) {
          referenceImageBase64 = lastImageData.base64;
          referenceImageMimeType = lastImageData.mimeType;
          console.log(`[Gemini] Using last generated image ${conversationContext.lastGeneratedAssetId} for multi-turn editing`);
        }
      }

      const geminiResponse = await generateImageGemini(supabase, {
        prompt,
        model: model as GeminiModelName,
        aspectRatio: aspectRatio || '1:1',
        resolution: resolution || '1K',
        referenceImageBase64,
        referenceImageMimeType,
      });

      // Convert base64 response to ArrayBuffer
      imageData = base64ToArrayBuffer(geminiResponse.imageBase64);
      contentType = geminiResponse.mimeType;
      imageDimensions = getImageDimensions(imageData, contentType);
      usedModel = model;

      // Update conversation context with thought signature if available
      // Requirements: 2.6, 2.7
      if (conversationId && geminiResponse.thoughtSignature) {
        await updateConversationContext(supabase, conversationId, {
          providerContext: {
            gemini: {
              thought_signature: geminiResponse.thoughtSignature,
              updated_at: new Date().toISOString(),
            },
          },
        });
      }
    } else {
      // Volcengine provider (default)
      const { imageUrl } = await generateImageVolcengine(prompt, width, height, model, refImage);
      const downloaded = await downloadImage(imageUrl);
      imageData = downloaded.data;
      contentType = downloaded.contentType;
      imageDimensions = getImageDimensions(imageData, contentType);
    }
    
    const assetId = crypto.randomUUID();
    const extension = contentType === 'image/jpeg' ? 'jpg' : 'png';
    const storagePath = `${userId}/${projectId}/${assetId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(storagePath, imageData, { contentType, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { error: assetError } = await supabase.from('assets').insert({
      id: assetId,
      project_id: projectId,
      user_id: userId,
      type: 'generate',
      storage_path: storagePath,
      filename: `generated-${assetId}.${extension}`,
      mime_type: contentType,
      size_bytes: imageData.byteLength,
      metadata: {
        source: { type: 'generate', origin: 'ai_generation', timestamp: new Date().toISOString() },
        generation: { 
          model: usedModel, 
          prompt, 
          parameters: { 
            width, 
            height,
            aspectRatio: aspectRatio || undefined,
            resolution: resolution || undefined,
          } 
        },
        scan: { status: 'pending' },
        dimensions: imageDimensions,
      },
    });
    if (assetError) throw new Error(`Asset creation failed: ${assetError.message}`);

    // Update conversation with last generated asset ID
    // Requirements: 2.6
    if (conversationId) {
      await updateConversationContext(supabase, conversationId, {
        lastGeneratedAssetId: assetId,
      });
    }

    // Use public URL instead of signed URL (bucket is public)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/assets/${storagePath}`;

    // Calculate display size maintaining aspect ratio
    // Target max dimension is 400px, but keep original aspect ratio
    const MAX_DISPLAY_SIZE = 400;
    let displayWidth = MAX_DISPLAY_SIZE;
    let displayHeight = MAX_DISPLAY_SIZE;
    
    if (imageDimensions) {
      const { width: imgWidth, height: imgHeight } = imageDimensions;
      const aspectRatioValue = imgWidth / imgHeight;
      
      if (aspectRatioValue >= 1) {
        // Landscape or square: width is the limiting factor
        displayWidth = MAX_DISPLAY_SIZE;
        displayHeight = Math.round(MAX_DISPLAY_SIZE / aspectRatioValue);
      } else {
        // Portrait: height is the limiting factor
        displayHeight = MAX_DISPLAY_SIZE;
        displayWidth = Math.round(MAX_DISPLAY_SIZE * aspectRatioValue);
      }
    }

    // Use placeholder position from frontend, or fallback to random position
    const imageX = placeholderX ?? (100 + Math.floor(Math.random() * 300));
    const imageY = placeholderY ?? (100 + Math.floor(Math.random() * 300));

    const layerId = generateLayerId();
    const addImageOp = {
      type: 'addImage',
      payload: { 
        id: layerId, 
        src: publicUrl, 
        x: imageX, 
        y: imageY, 
        width: displayWidth, 
        height: displayHeight 
      },
    };

    const { error: opError } = await supabase.from('ops').insert({
      document_id: documentId,
      conversation_id: conversationId || null,
      op_type: 'addImage',
      payload: addImageOp.payload,
    });
    if (opError) throw new Error(`Op creation failed: ${opError.message}`);

    await updateJobStatus(supabase, job.id, 'done', {
      assetId, storagePath, publicUrl, layerId, op: addImageOp,
      model: usedModel,
      resolution: resolution || undefined,
      aspectRatio: aspectRatio || undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJobStatus(supabase, job.id, 'failed', undefined, errorMessage);
    throw error;
  }
}

async function updateJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  status: JobStatus,
  output?: Record<string, unknown>,
  error?: string
): Promise<void> {
  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (output !== undefined) updateData.output = output;
  if (error !== undefined) updateData.error = error;
  await supabase.from('jobs').update(updateData).eq('id', jobId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Method not allowed' } }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateRequest(body)) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Missing required fields' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId, documentId, prompt, model, width = 1024, height = 1024, conversationId, imageUrl, placeholderX, placeholderY, aspectRatio, resolution } = body;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing authorization' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid auth' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: project } = await supabaseUser.from('projects').select('id').eq('id', projectId).single();
    if (!project) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Project not found' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: document } = await supabaseUser.from('documents').select('id').eq('id', documentId).single();
    if (!document) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Document not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // Gemini-specific validation
    // Requirements: 3.2-3.5, 3.8
    // =========================================================================
    
    // Determine the model name for points calculation
    const imageModel = model || Deno.env.get('VOLCENGINE_IMAGE_MODEL') || 'doubao-seedream-4-5-251128';
    const isGemini = isGeminiModel(imageModel);
    
    // Validate resolution for Gemini models
    let effectiveResolution: ResolutionPreset = '1K';
    if (isGemini) {
      effectiveResolution = resolution || '1K';
      
      // Validate aspect ratio
      if (aspectRatio && !SUPPORTED_ASPECT_RATIOS.includes(aspectRatio)) {
        return new Response(
          JSON.stringify({ 
            error: { 
              code: ERROR_CODES.INVALID_REQUEST, 
              message: `Unsupported aspect ratio: ${aspectRatio}. Supported: ${SUPPORTED_ASPECT_RATIOS.join(', ')}` 
            } 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check user's membership resolution permission
      // Requirements: 3.2, 3.3, 3.4, 3.5
      const userMaxResolution = await getUserMaxResolution(supabaseService, user.id);
      if (!validateResolutionPermission(effectiveResolution, userMaxResolution)) {
        return new Response(
          JSON.stringify({
            error: {
              code: ERROR_CODES.RESOLUTION_NOT_ALLOWED,
              message: `您的会员等级最高支持 ${userMaxResolution} 分辨率，请升级会员以使用 ${effectiveResolution}`,
              requested_resolution: effectiveResolution,
              max_allowed_resolution: userMaxResolution,
            },
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate model supports requested resolution
      // Requirements: 3.8
      const geminiModel = GEMINI_MODELS[imageModel as GeminiModelName];
      const modelMaxPixels = RESOLUTION_PRESETS[geminiModel.maxResolution];
      const requestedPixels = RESOLUTION_PRESETS[effectiveResolution];
      if (requestedPixels > modelMaxPixels) {
        return new Response(
          JSON.stringify({
            error: {
              code: ERROR_CODES.MODEL_RESOLUTION_MISMATCH,
              message: `模型 ${imageModel} 最高支持 ${geminiModel.maxResolution} 分辨率`,
              requested_resolution: effectiveResolution,
              model_max_resolution: geminiModel.maxResolution,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // Points Deduction Logic
    // Requirements: 2.2, 2.5, 2.6, 5.2-5.5, 5.8
    // =========================================================================
    
    // Get base points cost for the selected model
    let pointsCost = await getModelPointsCost(supabaseService, imageModel);
    
    // Apply resolution multiplier for Gemini models
    // Requirements: 5.3, 5.4, 5.5
    if (isGemini) {
      pointsCost = calculateGeminiPointsCost(pointsCost, effectiveResolution);
      console.log(`[Gemini] Points cost: base=${await getModelPointsCost(supabaseService, imageModel)}, resolution=${effectiveResolution}, total=${pointsCost}`);
    }
    
    // Attempt to deduct points before processing
    const deductionResult = await deductPoints(
      supabaseService,
      user.id,
      pointsCost,
      'generate_image',
      null, // reference_id will be set after job creation if needed
      imageModel
    );
    
    // If points deduction failed due to insufficient balance, return error
    // Requirements: 5.6
    if (!deductionResult.success) {
      // Get display name for better UX
      const displayName = await getModelDisplayName(supabaseService, imageModel);
      return new Response(
        JSON.stringify({
          error: {
            code: ERROR_CODES.INSUFFICIENT_POINTS,
            message: `点数不足，当前余额 ${deductionResult.error.current_balance}，需要 ${deductionResult.error.required_points} 点`,
            current_balance: deductionResult.error.current_balance,
            required_points: deductionResult.error.required_points,
            model_name: displayName,
          },
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Points deducted successfully, store the result for response
    const pointsDeducted = deductionResult.result.points_deducted;
    const remainingPoints = deductionResult.result.balance_after;

    const { data: job, error: jobError } = await supabaseService
      .from('jobs')
      .insert({
        project_id: projectId,
        document_id: documentId,
        user_id: user.id,
        type: 'generate-image',
        status: 'queued',
        input: { 
          projectId, 
          documentId, 
          prompt, 
          model: imageModel, 
          width, 
          height, 
          conversationId, 
          imageUrl, 
          placeholderX, 
          placeholderY,
          // Gemini-specific parameters
          aspectRatio: isGemini ? (aspectRatio || '1:1') : undefined,
          resolution: isGemini ? effectiveResolution : undefined,
        },
      })
      .select()
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Failed to create job' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = new Response(
      JSON.stringify({ 
        jobId: job.id,
        pointsDeducted,
        remainingPoints,
        modelUsed: imageModel,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    const processPromise = processJob(supabaseService, job, user.id).catch(console.error);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(processPromise);
    }

    return response;
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void };
