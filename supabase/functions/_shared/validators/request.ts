/**
 * Request Validator Module
 * Centralized request validation for image generation
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import {
  type AspectRatio,
  type ResolutionPreset,
  SUPPORTED_ASPECT_RATIOS,
  RESOLUTION_PRESETS,
  isValidAspectRatio,
  isValidResolution,
} from '../types/index.ts';

// ============================================================================
// Validated Request Types
// ============================================================================

/**
 * Validated and typed request data
 * All required fields are guaranteed to be present and valid
 * Requirements: 2.6
 */
export interface ValidatedRequest {
  /** Project ID (required, validated) */
  projectId: string;
  /** Document ID (required, validated) */
  documentId: string;
  /** Generation prompt (required, validated) */
  prompt: string;
  /** Model name (defaults to Volcengine) */
  model: string;
  /** Image width in pixels (defaults to 1024) */
  width: number;
  /** Image height in pixels (defaults to 1024) */
  height: number;
  /** Conversation ID for multi-turn context (optional) */
  conversationId?: string;
  /** Reference image URL for image-to-image (optional) */
  imageUrl?: string;
  /** X position for placeholder on canvas (optional) */
  placeholderX?: number;
  /** Y position for placeholder on canvas (optional) */
  placeholderY?: number;
  /** Aspect ratio for Gemini models (optional, validated) */
  aspectRatio?: AspectRatio;
  /** Resolution preset for Gemini models (optional, validated) */
  resolution?: ResolutionPreset;
}

/**
 * Validation result with typed data
 * Requirements: 2.4, 2.5
 */
export interface RequestValidationResult {
  /** Whether the request is valid */
  valid: boolean;
  /** List of validation error messages (empty if valid) */
  errors: string[];
  /** Validated and typed request data (only present if valid) */
  data?: ValidatedRequest;
}

// ============================================================================
// Request Validator Class
// ============================================================================

/**
 * Request validator for image generation requests
 * Validates required fields and optional field types
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export class RequestValidator {
  /** Default model when not specified */
  private static readonly DEFAULT_MODEL = 'doubao-seedream-4-5-251128';
  /** Default width when not specified */
  private static readonly DEFAULT_WIDTH = 1024;
  /** Default height when not specified */
  private static readonly DEFAULT_HEIGHT = 1024;

  /**
   * Validate and transform raw request body
   * Requirements: 2.2, 2.3, 2.4, 2.5
   * 
   * @param body - Raw request body (unknown type)
   * @returns Validation result with typed data if valid
   */
  validate(body: unknown): RequestValidationResult {
    const errors: string[] = [];

    // Check body is an object
    if (!body || typeof body !== 'object') {
      return { valid: false, errors: ['Request body must be an object'] };
    }

    const b = body as Record<string, unknown>;

    // Validate required fields (Requirements: 2.2)
    if (!this.isNonEmptyString(b.projectId)) {
      errors.push('projectId is required and must be a non-empty string');
    }
    if (!this.isNonEmptyString(b.documentId)) {
      errors.push('documentId is required and must be a non-empty string');
    }
    if (!this.isNonEmptyString(b.prompt)) {
      errors.push('prompt is required and must be a non-empty string');
    }

    // Validate optional fields with type checking (Requirements: 2.3)
    if (b.model !== undefined && !this.isNonEmptyString(b.model)) {
      errors.push('model must be a non-empty string');
    }
    if (b.width !== undefined && !this.isPositiveNumber(b.width)) {
      errors.push('width must be a positive number');
    }
    if (b.height !== undefined && !this.isPositiveNumber(b.height)) {
      errors.push('height must be a positive number');
    }
    if (b.aspectRatio !== undefined && !isValidAspectRatio(b.aspectRatio)) {
      errors.push(`Invalid aspectRatio: ${b.aspectRatio}. Supported values: ${SUPPORTED_ASPECT_RATIOS.join(', ')}`);
    }
    if (b.resolution !== undefined && !isValidResolution(b.resolution)) {
      errors.push(`Invalid resolution: ${b.resolution}. Supported values: ${Object.keys(RESOLUTION_PRESETS).join(', ')}`);
    }
    if (b.conversationId !== undefined && typeof b.conversationId !== 'string') {
      errors.push('conversationId must be a string');
    }
    if (b.imageUrl !== undefined && typeof b.imageUrl !== 'string') {
      errors.push('imageUrl must be a string');
    }
    if (b.placeholderX !== undefined && typeof b.placeholderX !== 'number') {
      errors.push('placeholderX must be a number');
    }
    if (b.placeholderY !== undefined && typeof b.placeholderY !== 'number') {
      errors.push('placeholderY must be a number');
    }

    // Return errors if any (Requirements: 2.4, 2.5)
    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Return validated data (Requirements: 2.6)
    return {
      valid: true,
      errors: [],
      data: {
        projectId: b.projectId as string,
        documentId: b.documentId as string,
        prompt: b.prompt as string,
        model: (b.model as string) || RequestValidator.DEFAULT_MODEL,
        width: (b.width as number) || RequestValidator.DEFAULT_WIDTH,
        height: (b.height as number) || RequestValidator.DEFAULT_HEIGHT,
        conversationId: b.conversationId as string | undefined,
        imageUrl: b.imageUrl as string | undefined,
        placeholderX: b.placeholderX as number | undefined,
        placeholderY: b.placeholderY as number | undefined,
        aspectRatio: b.aspectRatio as AspectRatio | undefined,
        resolution: b.resolution as ResolutionPreset | undefined,
      },
    };
  }

  /**
   * Check if a value is a non-empty string
   */
  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Check if a value is a positive number
   */
  private isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && value > 0 && Number.isFinite(value);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new RequestValidator instance
 */
export function createRequestValidator(): RequestValidator {
  return new RequestValidator();
}

/**
 * Validate a request body using a new validator instance
 * Convenience function for one-off validation
 * 
 * @param body - Raw request body
 * @returns Validation result
 */
export function validateRequest(body: unknown): RequestValidationResult {
  return new RequestValidator().validate(body);
}
