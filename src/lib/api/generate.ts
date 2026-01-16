/**
 * AI Generation API Client
 * Unified API layer for image and ops generation
 * Requirements: 12.1-12.7 - AI design generation
 */

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
 * Generate image via AI
 * 
 * @param params - Image generation parameters
 * @param accessToken - User's access token for authentication
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with job ID and points info
 * @throws GenerationApiError on failure
 */
export async function generateImage(
  params: GenerateImageParams,
  accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateImageResult> {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
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
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new GenerationApiError(
      errorData?.error?.message || 'Image generation failed',
      errorData?.error?.code || 'IMAGE_GENERATION_FAILED',
      response.status,
      errorData?.error
    );
  }

  return response.json();
}

/**
 * Generate canvas ops via AI
 * 
 * @param params - Ops generation parameters
 * @param accessToken - User's access token for authentication
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with plan and ops array
 * @throws GenerationApiError on failure
 */
export async function generateOps(
  params: GenerateOpsParams,
  accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateOpsResult> {
  const response = await fetch('/api/generate-ops', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      projectId: params.projectId,
      documentId: params.documentId,
      conversationId: params.conversationId,
      prompt: params.prompt,
      model: params.model,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new GenerationApiError(
      errorData?.error?.message || 'Generation failed',
      errorData?.error?.code || 'GENERATION_FAILED',
      response.status,
      errorData?.error
    );
  }

  return response.json();
}
