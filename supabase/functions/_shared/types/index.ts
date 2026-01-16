/**
 * Shared Type Definitions for Image Generation
 * Requirements: 9.1, 9.2
 */

// ============================================================================
// Resolution and Aspect Ratio Types
// ============================================================================

/**
 * Resolution presets mapping to max pixel dimensions
 */
export const RESOLUTION_PRESETS = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
} as const;

export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

/**
 * Supported aspect ratios for image generation
 */
export const SUPPORTED_ASPECT_RATIOS = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '4:5', '5:4', '21:9'
] as const;

export type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Image generation request payload
 */
export interface ImageGenerateRequest {
  /** Project ID (required) */
  projectId: string;
  /** Document ID (required) */
  documentId: string;
  /** Generation prompt (required) */
  prompt: string;
  /** Model name (optional, defaults to Volcengine) */
  model?: string;
  /** Image width in pixels (optional) */
  width?: number;
  /** Image height in pixels (optional) */
  height?: number;
  /** Conversation ID for multi-turn context (optional) */
  conversationId?: string;
  /** Reference image URL for image-to-image (optional) */
  imageUrl?: string;
  /** X position for placeholder on canvas (optional) */
  placeholderX?: number;
  /** Y position for placeholder on canvas (optional) */
  placeholderY?: number;
  /** Aspect ratio for Gemini models (optional) */
  aspectRatio?: AspectRatio;
  /** Resolution preset for Gemini models (optional) */
  resolution?: ResolutionPreset;
}

/**
 * Successful image generation response
 */
export interface ImageGenerateResponse {
  /** Created job ID */
  jobId: string;
  /** Points deducted for this generation */
  pointsDeducted: number;
  /** Remaining points balance after deduction */
  remainingPoints: number;
  /** Model used for generation */
  modelUsed: string;
}

/**
 * Job output after successful image generation
 */
export interface JobOutput {
  /** Generated asset ID */
  assetId: string;
  /** Storage path in Supabase storage */
  storagePath: string;
  /** Public URL to access the image */
  publicUrl: string;
  /** Layer ID for canvas */
  layerId: string;
  /** Canvas operation to add the image */
  op: {
    type: 'addImage';
    payload: {
      id: string;
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  /** Model used for generation */
  model: string;
  /** Resolution used (Gemini only) */
  resolution?: string;
  /** Aspect ratio used (Gemini only) */
  aspectRatio?: string;
}

// ============================================================================
// Job Types
// ============================================================================

/**
 * Job status values
 */
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * Job record structure
 */
export interface Job {
  id: string;
  projectId: string;
  documentId: string;
  userId: string;
  type: string;
  status: JobStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Points Types
// ============================================================================

/**
 * Points deduction result from RPC
 */
export interface DeductPointsResult {
  success: boolean;
  pointsDeducted: number;
  balanceAfter: number;
  transactionId: string;
}

// ============================================================================
// User Types
// ============================================================================

/**
 * Authenticated user info
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * User membership info
 */
export interface UserMembership {
  level: 'free' | 'pro' | 'team';
  maxResolution: ResolutionPreset;
}

// ============================================================================
// Asset Types
// ============================================================================

/**
 * Asset record structure
 */
export interface AssetRecord {
  id: string;
  projectId: string;
  userId: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  dimensions?: { width: number; height: number };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid AspectRatio
 */
export function isValidAspectRatio(value: unknown): value is AspectRatio {
  return typeof value === 'string' && SUPPORTED_ASPECT_RATIOS.includes(value as AspectRatio);
}

/**
 * Check if a value is a valid ResolutionPreset
 */
export function isValidResolution(value: unknown): value is ResolutionPreset {
  return typeof value === 'string' && value in RESOLUTION_PRESETS;
}

/**
 * Check if a value is a valid JobStatus
 */
export function isValidJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && ['queued', 'processing', 'done', 'failed'].includes(value);
}
