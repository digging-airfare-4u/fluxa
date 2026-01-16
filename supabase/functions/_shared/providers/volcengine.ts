/**
 * Volcengine Image Generation Provider
 * Implements ImageProvider interface for Volcengine (Doubao) API
 * Requirements: 1.3
 */

import { ProviderError } from '../errors/index.ts';
import {
  type ImageProvider,
  type ImageResult,
  type ProviderRequest,
  type ProviderCapabilities,
  type ValidationResult,
  type AspectRatio,
  SUPPORTED_ASPECT_RATIOS,
} from './types.ts';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert base64 string to ArrayBuffer
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
 * Download image from URL and return as ArrayBuffer
 */
async function downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ProviderError(
      `Failed to download image: ${response.status}`,
      'DOWNLOAD_ERROR'
    );
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const data = await response.arrayBuffer();
  return { data, contentType };
}

/**
 * Get image dimensions from ArrayBuffer
 */
function getImageDimensions(
  data: ArrayBuffer,
  contentType: string
): { width: number; height: number } | null {
  const bytes = new Uint8Array(data);
  
  // PNG: dimensions at bytes 16-23
  if (contentType.includes('png') && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }
  
  // JPEG: parse markers to find SOF0/SOF2
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    let i = 2;
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xFF) break;
      const marker = bytes[i + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + length;
    }
  }
  
  return null;
}

// ============================================================================
// Volcengine Provider Implementation
// ============================================================================

/**
 * Volcengine Provider for image generation
 * Supports text-to-image and image-to-image via Volcengine (Doubao) API
 */
export class VolcengineProvider implements ImageProvider {
  readonly name = 'volcengine';
  readonly capabilities: ProviderCapabilities = {
    supportsImageToImage: true,
    maxResolution: '2K',
    supportedAspectRatios: ['1:1'] as readonly AspectRatio[],
  };
  
  private modelName: string;
  
  constructor(modelName?: string) {
    // Use provided model name, or try to get from Deno env, or use default
    if (modelName) {
      this.modelName = modelName;
    } else if (typeof Deno !== 'undefined' && Deno.env) {
      this.modelName = Deno.env.get('VOLCENGINE_IMAGE_MODEL') || 'doubao-seedream-4-5-251128';
    } else {
      this.modelName = 'doubao-seedream-4-5-251128';
    }
  }
  
  /**
   * Generate image using Volcengine API
   * @throws ProviderError on generation failure
   */
  async generate(request: ProviderRequest): Promise<ImageResult> {
    // Get API key from Deno env (only available in Deno runtime)
    const apiKey = typeof Deno !== 'undefined' && Deno.env ? Deno.env.get('VOLCENGINE_API_KEY') : undefined;
    if (!apiKey) {
      throw new ProviderError('VOLCENGINE_API_KEY not configured', 'CONFIG_ERROR');
    }
    
    // Validate request first
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new ProviderError(
        `Invalid request: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
    
    const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    
    // Volcengine requires minimum 1920x1920 (2K)
    const size = '2K';
    
    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      prompt: request.prompt,
      size,
      watermark: false,
      sequential_image_generation: 'disabled',
    };
    
    // Image-to-image: add reference image as array
    if (request.referenceImageBase64) {
      // Volcengine expects base64 data URL or URL
      requestBody.image = [`data:${request.referenceImageMimeType || 'image/png'};base64,${request.referenceImageBase64}`];
    }
    
    console.log(`[Volcengine] Generating image with model: ${this.modelName}`);
    
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
      console.error(`[Volcengine] API error: ${response.status} - ${errorText}`);
      throw new ProviderError(
        `Volcengine API error: ${response.status}`,
        'API_ERROR',
        errorText
      );
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  /**
   * Validate request against provider capabilities
   */
  validateRequest(request: ProviderRequest): ValidationResult {
    const errors: string[] = [];
    
    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }
    
    // Note: Volcengine has limited aspect ratio support
    // We don't fail validation but the API may not respect non-1:1 ratios
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Parse Volcengine API response
   * Handles both URL and base64 response formats
   */
  private async parseResponse(data: Record<string, unknown>): Promise<ImageResult> {
    const imageData = (data.data as Array<{ url?: string; b64_json?: string }>)?.[0];
    
    if (!imageData) {
      throw new ProviderError('No image data in response', 'PARSE_ERROR');
    }
    
    // Handle base64 response
    if (imageData.b64_json) {
      const arrayBuffer = base64ToArrayBuffer(imageData.b64_json);
      const mimeType = 'image/png';
      const dimensions = getImageDimensions(arrayBuffer, mimeType);
      
      return {
        imageData: arrayBuffer,
        mimeType,
        width: dimensions?.width,
        height: dimensions?.height,
        metadata: {
          responseType: 'base64',
        },
      };
    }
    
    // Handle URL response
    if (imageData.url) {
      const { data: arrayBuffer, contentType } = await downloadImage(imageData.url);
      const dimensions = getImageDimensions(arrayBuffer, contentType);
      
      return {
        imageData: arrayBuffer,
        mimeType: contentType,
        width: dimensions?.width,
        height: dimensions?.height,
        metadata: {
          responseType: 'url',
          originalUrl: imageData.url,
        },
      };
    }
    
    throw new ProviderError('Invalid response format: no url or b64_json', 'PARSE_ERROR');
  }
}
