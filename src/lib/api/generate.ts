/**
 * AI Generation API Client
 * Unified API layer for image and ops generation
 * Uses Supabase Edge Functions directly via supabase.functions.invoke
 * Requirements: 12.1-12.7 - AI design generation
 */

import { supabase } from '@/lib/supabase/client';
import type { Op } from '@/lib/canvas/ops.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for image generation
 */
export interface GenerateImageParams {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  imageUrl?: string;
  placeholderX?: number;
  placeholderY?: number;
  aspectRatio?: string;
  resolution?: string;
}

/**
 * Parameters for ops generation
 */
export interface GenerateOpsParams {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
}

/**
 * Parameters for image tool processing
 */
export interface ImageToolParams {
  projectId: string;
  documentId: string;
  tool: 'removeBackground' | 'upscale' | 'erase' | 'expand';
  imageUrl: string;
  targetX?: number;
  targetY?: number;
  model?: string;
  params?: Record<string, unknown>;
  source?: {
    type: 'canvas_tool';
    originLayerId?: string;
  };
}


/**
 * Successful image generation response
 */
export interface GenerateImageResult {
  jobId: string;
  pointsDeducted?: number;
  remainingPoints?: number;
}

/**
 * Successful ops generation response
 */
export interface GenerateOpsResult {
  plan: string;
  ops: Op[];
  pointsDeducted?: number;
  remainingPoints?: number;
}

/**
 * Successful image tool response
 */
export interface ImageToolResult {
  jobId: string;
  pointsDeducted?: number;
  remainingPoints?: number;
  modelUsed?: string;
}


/**
 * API error response structure
 */
export interface ApiError {
  code: string;
  message: string;
  current_balance?: number;
  required_points?: number;
  model_name?: string;
  membership_level?: string;
}

/**
 * Generation API error with structured error data
 */
export class GenerationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Partial<ApiError>
  ) {
    super(message);
    this.name = 'GenerationApiError';
  }

  /**
   * Check if this is an insufficient points error
   */
  isInsufficientPoints(): boolean {
    return this.code === 'INSUFFICIENT_POINTS';
  }

  /**
   * Get insufficient points details if applicable
   */
  getInsufficientPointsDetails() {
    if (!this.isInsufficientPoints()) return null;
    return {
      code: this.code,
      current_balance: this.details?.current_balance ?? 0,
      required_points: this.details?.required_points ?? 0,
      model_name: this.details?.model_name,
      membership_level: this.details?.membership_level,
    };
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Generate image via AI using Supabase Edge Function
 * 
 * @param params - Image generation parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with job ID and points info
 * @throws GenerationApiError on failure
 */
export async function generateImage(
  params: GenerateImageParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateImageResult> {
  // Ensure we have a fresh session before calling the Edge Function
  // This handles cases where the token might be expired
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      console.error('[generateImage] Failed to refresh session:', refreshError);
      throw new GenerationApiError(
        'Authentication required',
        'AUTH_REQUIRED',
        401
      );
    }
  }

  // Get the current access token to pass explicitly
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const accessToken = currentSession?.access_token;

  if (!accessToken) {
    throw new GenerationApiError(
      'No access token available',
      'AUTH_REQUIRED',
      401
    );
  }

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    conversationId: params.conversationId,
    prompt: params.prompt,
    model: params.model,
    width: params.width ?? 1024,
    height: params.height ?? 1024,
    imageUrl: params.imageUrl,
    placeholderX: params.placeholderX,
    placeholderY: params.placeholderY,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
  };

  console.log('[generateImage] ========== CLIENT REQUEST START ==========');
  console.log('[generateImage] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[generateImage] ========== CLIENT REQUEST END ==========');

  // Use supabase.functions.invoke with explicit Authorization header
  const { data, error } = await supabase.functions.invoke<GenerateImageResult>('generate-image', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[generateImage] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[generateImage] Error:', error);
    console.error('[generateImage] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[generateImage] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[generateImage] ========== CLIENT RESPONSE END ==========');

  // Handle abort signal
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    // Parse error response
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;
    
    throw new GenerationApiError(
      apiError?.message || error.message || 'Image generation failed',
      apiError?.code || 'IMAGE_GENERATION_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from generate-image',
      'NO_DATA',
      500
    );
  }

  return data;
}

/**
 * Generate canvas ops via AI using Supabase Edge Function
 * 
 * @param params - Ops generation parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with plan and ops array
 * @throws GenerationApiError on failure
 */

/**
 * Run image tool via AI using Supabase Edge Function
 *
 * @param params - Image tool parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with job ID and points info
 * @throws GenerationApiError on failure
 */
export async function runImageTool(
  params: ImageToolParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<ImageToolResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      console.error('[runImageTool] Failed to refresh session:', refreshError);
      throw new GenerationApiError(
        'Authentication required',
        'AUTH_REQUIRED',
        401
      );
    }
  }

  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const accessToken = currentSession?.access_token;

  if (!accessToken) {
    throw new GenerationApiError(
      'No access token available',
      'AUTH_REQUIRED',
      401
    );
  }

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    tool: params.tool,
    imageUrl: params.imageUrl,
    targetX: params.targetX,
    targetY: params.targetY,
    model: params.model,
    params: params.params,
    source: params.source,
  };

  console.log('[runImageTool] ========== CLIENT REQUEST START ==========');
  console.log('[runImageTool] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[runImageTool] ========== CLIENT REQUEST END ==========');

  const { data, error } = await supabase.functions.invoke<ImageToolResult>('image-tools', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[runImageTool] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[runImageTool] Error:', error);
    console.error('[runImageTool] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[runImageTool] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[runImageTool] ========== CLIENT RESPONSE END ==========');

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;

    throw new GenerationApiError(
      apiError?.message || error.message || 'Image tool processing failed',
      apiError?.code || 'IMAGE_TOOL_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from image-tools',
      'NO_DATA',
      500
    );
  }

  return data;
}

export async function generateOps(
  params: GenerateOpsParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateOpsResult> {
  // Ensure we have a fresh session before calling the Edge Function
  // This handles cases where the token might be expired
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      console.error('[generateOps] Failed to refresh session:', refreshError);
      throw new GenerationApiError(
        'Authentication required',
        'AUTH_REQUIRED',
        401
      );
    }
  }

  // Get the current access token to pass explicitly
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const accessToken = currentSession?.access_token;

  if (!accessToken) {
    throw new GenerationApiError(
      'No access token available',
      'AUTH_REQUIRED',
      401
    );
  }

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    conversationId: params.conversationId,
    prompt: params.prompt,
    model: params.model,
  };

  console.log('[generateOps] ========== CLIENT REQUEST START ==========');
  console.log('[generateOps] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[generateOps] ========== CLIENT REQUEST END ==========');

  // Use supabase.functions.invoke with explicit Authorization header
  const { data, error } = await supabase.functions.invoke<GenerateOpsResult>('generate-ops', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[generateOps] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[generateOps] Error:', error);
    console.error('[generateOps] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[generateOps] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[generateOps] ========== CLIENT RESPONSE END ==========');

  // Handle abort signal
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    // Parse error response
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;
    
    throw new GenerationApiError(
      apiError?.message || error.message || 'Generation failed',
      apiError?.code || 'GENERATION_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from generate-ops',
      'NO_DATA',
      500
    );
  }

  return data;
}
