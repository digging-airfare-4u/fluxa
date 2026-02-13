/**
 * Provider Interface Types
 * Defines the abstract interface for image generation providers
 * Requirements: 1.1
 */

import type { AspectRatio, ResolutionPreset } from '../types/index.ts';

// Re-export for convenience
export type { AspectRatio, ResolutionPreset };
export { RESOLUTION_PRESETS, SUPPORTED_ASPECT_RATIOS } from '../types/index.ts';

// ============================================================================
// Image Result Types
// ============================================================================

/**
 * Image generation result from any provider
 */
export interface ImageResult {
  /** Raw image data as ArrayBuffer */
  imageData: ArrayBuffer;
  /** MIME type of the image (e.g., 'image/png', 'image/jpeg') */
  mimeType: string;
  /** Image width in pixels (if available) */
  width?: number;
  /** Image height in pixels (if available) */
  height?: number;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Provider Request Types
// ============================================================================

/**
 * Common request parameters for all providers
 */
export interface ProviderRequest {
  /** Text prompt for image generation */
  prompt: string;
  /** Desired image width in pixels */
  width?: number;
  /** Desired image height in pixels */
  height?: number;
  /** Aspect ratio for the generated image */
  aspectRatio?: AspectRatio;
  /** Resolution preset (1K, 2K, 4K) */
  resolution?: ResolutionPreset;
  /** Base64-encoded reference image for image-to-image generation */
  referenceImageBase64?: string;
  /** MIME type of the reference image */
  referenceImageMimeType?: string;
  /** Gemini Files API URI for large reference images */
  referenceImageFileUri?: string;
  /** Gemini Files API resource name (for cleanup) */
  referenceImageFileName?: string;
}

// ============================================================================
// Provider Capabilities
// ============================================================================

/**
 * Provider capabilities declaration
 * Describes what features a provider supports
 */
export interface ProviderCapabilities {
  /** Whether the provider supports image-to-image generation */
  supportsImageToImage: boolean;
  /** Maximum resolution the provider supports */
  maxResolution: ResolutionPreset;
  /** List of supported aspect ratios */
  supportedAspectRatios: readonly AspectRatio[];
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of request validation
 */
export interface ValidationResult {
  /** Whether the request is valid */
  valid: boolean;
  /** List of validation error messages (empty if valid) */
  errors: string[];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Abstract interface for image generation providers
 * All providers must implement this interface
 * Requirements: 1.1
 */
export interface ImageProvider {
  /** Provider name identifier */
  readonly name: string;
  
  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;
  
  /**
   * Generate image from request
   * @param request - The generation request parameters
   * @returns Promise resolving to the generated image result
   * @throws ProviderError on generation failure
   */
  generate(request: ProviderRequest): Promise<ImageResult>;
  
  /**
   * Validate request against provider capabilities
   * @param request - The request to validate
   * @returns Validation result with any errors
   */
  validateRequest(request: ProviderRequest): ValidationResult;
}

// ============================================================================
// Model Configuration Types
// ============================================================================

/**
 * Gemini model names
 */
export const GEMINI_MODELS = {
  'gemini-2.5-flash-image': {
    maxResolution: '2K' as ResolutionPreset,
    supportsImageToImage: true,
  },
  'gemini-3-pro-image-preview': {
    maxResolution: '4K' as ResolutionPreset,
    supportsImageToImage: true,
  },
} as const;

export type GeminiModelName = keyof typeof GEMINI_MODELS;

/**
 * Check if a model name is a Gemini model
 */
export function isGeminiModel(model: string): model is GeminiModelName {
  return model in GEMINI_MODELS;
}

/**
 * Volcengine model configuration
 */
export const VOLCENGINE_MODELS = {
  'doubao-seedream-4-5-251128': {
    maxResolution: '2K' as ResolutionPreset,
    supportsImageToImage: true,
  },
} as const;

export type VolcengineModelName = keyof typeof VOLCENGINE_MODELS;

/**
 * Check if a model name is a Volcengine model
 */
export function isVolcengineModel(model: string): model is VolcengineModelName {
  return model in VOLCENGINE_MODELS;
}
