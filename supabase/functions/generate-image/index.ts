/**
 * Generate Image Edge Function
 * Supports text-to-image and image-to-image generation
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

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
  };

  // Image-to-image: add reference image
  if (referenceImageUrl) {
    requestBody.image = referenceImageUrl;
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
  const { projectId, documentId, prompt, model, width, height, conversationId, imageUrl: refImage, placeholderX, placeholderY } = job.input as {
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
  };

  try {
    await updateJobStatus(supabase, job.id, 'processing');

    const { imageUrl } = await generateImageVolcengine(prompt, width, height, model, refImage);
    const { data: imageData, contentType } = await downloadImage(imageUrl);

    // Get actual image dimensions
    const imageDimensions = getImageDimensions(imageData, contentType);
    
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
        generation: { model: model || 'doubao-seedream-4-5-251128', prompt, parameters: { width, height } },
        scan: { status: 'pending' },
        dimensions: imageDimensions,
      },
    });
    if (assetError) throw new Error(`Asset creation failed: ${assetError.message}`);

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
      const aspectRatio = imgWidth / imgHeight;
      
      if (aspectRatio >= 1) {
        // Landscape or square: width is the limiting factor
        displayWidth = MAX_DISPLAY_SIZE;
        displayHeight = Math.round(MAX_DISPLAY_SIZE / aspectRatio);
      } else {
        // Portrait: height is the limiting factor
        displayHeight = MAX_DISPLAY_SIZE;
        displayWidth = Math.round(MAX_DISPLAY_SIZE * aspectRatio);
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

    const { projectId, documentId, prompt, model, width = 1024, height = 1024, conversationId, imageUrl, placeholderX, placeholderY } = body;

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
    // Points Deduction Logic
    // Requirements: 2.2, 2.5, 2.6
    // =========================================================================
    
    // Determine the model name for points calculation
    const imageModel = model || Deno.env.get('VOLCENGINE_IMAGE_MODEL') || 'doubao-seedream-4-5-251128';
    
    // Get points cost for the selected model
    const pointsCost = await getModelPointsCost(supabaseService, imageModel);
    
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
        input: { projectId, documentId, prompt, model, width, height, conversationId, imageUrl, placeholderX, placeholderY },
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
