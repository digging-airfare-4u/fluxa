/**
 * Gemini Image Generation Provider
 * Implements ImageProvider interface for Google Generative AI API
 * Requirements: 1.2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ProviderError } from '../errors/index.ts';
import {
  type ImageProvider,
  type ImageResult,
  type ProviderRequest,
  type ProviderCapabilities,
  type ValidationResult,
  type GeminiModelName,
  type AspectRatio,
  type ResolutionPreset,
  GEMINI_MODELS,
  SUPPORTED_ASPECT_RATIOS,
  RESOLUTION_PRESETS,
} from './types.ts';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse aspect ratio string to width/height ratio
 */
function parseAspectRatio(aspectRatio: AspectRatio): { widthRatio: number; heightRatio: number } {
  const [w, h] = aspectRatio.split(':').map(Number);
  return { widthRatio: w, heightRatio: h };
}

/**
 * Calculate pixel dimensions from resolution preset and aspect ratio
 */
export function calculateDimensions(
  resolution: ResolutionPreset,
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const maxDimension = RESOLUTION_PRESETS[resolution];
  const { widthRatio, heightRatio } = parseAspectRatio(aspectRatio);
  
  let width: number;
  let height: number;
  
  if (widthRatio >= heightRatio) {
    width = maxDimension;
    height = Math.round((maxDimension * heightRatio) / widthRatio);
  } else {
    height = maxDimension;
    width = Math.round((maxDimension * widthRatio) / heightRatio);
  }
  
  return { width, height };
}

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

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

/**
 * Gemini Provider for image generation
 * Supports text-to-image and image-to-image via Google Generative AI API
 */
export class GeminiProvider implements ImageProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  
  constructor(
    private supabase: SupabaseClient,
    private modelName: GeminiModelName
  ) {
    this.name = modelName;
    const modelConfig = GEMINI_MODELS[modelName];
    this.capabilities = {
      supportsImageToImage: modelConfig.supportsImageToImage,
      maxResolution: modelConfig.maxResolution,
      supportedAspectRatios: [...SUPPORTED_ASPECT_RATIOS],
    };
  }
  
  /**
   * Generate image using Gemini API
   * @throws ProviderError on generation failure
   */
  async generate(request: ProviderRequest): Promise<ImageResult> {
    // Get API key from Deno env (only available in Deno runtime)
    const apiKey = typeof Deno !== 'undefined' && Deno.env ? Deno.env.get('GEMINI_API_KEY') : undefined;
    if (!apiKey) {
      throw new ProviderError('GEMINI_API_KEY not configured', 'CONFIG_ERROR');
    }
    
    // Validate request first
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new ProviderError(
        `Invalid request: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
    
    const apiHost = await this.getApiHost();
    const requestBody = this.buildRequestBody(request);
    
    const resolution = request.resolution || '1K';
    const aspectRatio = request.aspectRatio || '1:1';
    
    console.log(`[Gemini] Generating image with model: ${this.modelName}, resolution: ${resolution}, aspectRatio: ${aspectRatio}`);
    
    const response = await fetch(
      `${apiHost}/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini] API error: ${response.status} - ${errorText}`);
      throw new ProviderError(
        `Gemini API error: ${response.status}`,
        'API_ERROR',
        errorText
      );
    }
    
    const responseData = await response.json();
    return this.parseResponse(responseData, request);
  }
  
  /**
   * Validate request against provider capabilities
   */
  validateRequest(request: ProviderRequest): ValidationResult {
    const errors: string[] = [];
    
    // Validate resolution
    if (request.resolution && !this.isResolutionSupported(request.resolution)) {
      errors.push(
        `Resolution ${request.resolution} exceeds model max ${this.capabilities.maxResolution}`
      );
    }
    
    // Validate aspect ratio
    if (request.aspectRatio && !this.capabilities.supportedAspectRatios.includes(request.aspectRatio)) {
      errors.push(`Aspect ratio ${request.aspectRatio} not supported`);
    }
    
    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Get Gemini API host from system_settings
   */
  private async getApiHost(): Promise<string> {
    const { data, error } = await this.supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'gemini_api_host')
      .single();
    
    if (error || !data?.value?.host) {
      return 'https://generativelanguage.googleapis.com';
    }
    
    return data.value.host;
  }
  
  /**
   * Build Gemini API request body
   */
  private buildRequestBody(request: ProviderRequest): Record<string, unknown> {
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
    const parts: Array<Record<string, unknown>> = [];
    
    // Add reference image if provided (image-to-image)
    if (request.referenceImageBase64 && request.referenceImageMimeType) {
      parts.push({
        inlineData: {
          mimeType: request.referenceImageMimeType,
          data: request.referenceImageBase64,
        },
      });
    }
    
    // Add text prompt
    parts.push({ text: request.prompt });
    
    contents.push({
      role: 'user',
      parts,
    });
    
    // Build generation config
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['image', 'text'],
    };
    
    // Add image config with aspect ratio
    if (request.aspectRatio) {
      generationConfig.imageConfig = {
        aspectRatio: request.aspectRatio,
      };
    }
    
    return {
      contents,
      generationConfig,
    };
  }
  
  /**
   * Parse Gemini API response to extract image data
   */
  private parseResponse(
    responseData: Record<string, unknown>,
    request: ProviderRequest
  ): ImageResult {
    const candidates = responseData.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) {
      throw new ProviderError('No candidates in Gemini response', 'PARSE_ERROR');
    }
    
    const content = candidates[0].content as Record<string, unknown> | undefined;
    if (!content) {
      throw new ProviderError('No content in Gemini response candidate', 'PARSE_ERROR');
    }
    
    const parts = content.parts as Array<Record<string, unknown>> | undefined;
    if (!parts || parts.length === 0) {
      throw new ProviderError('No parts in Gemini response content', 'PARSE_ERROR');
    }
    
    // Find the image part
    for (const part of parts) {
      const inlineData = part.inlineData as { mimeType: string; data: string } | undefined;
      if (inlineData?.data) {
        const imageData = base64ToArrayBuffer(inlineData.data);
        const dimensions = this.getImageDimensions(imageData, inlineData.mimeType);
        
        return {
          imageData,
          mimeType: inlineData.mimeType || 'image/png',
          width: dimensions?.width,
          height: dimensions?.height,
          metadata: {
            thoughtSignature: responseData.thoughtSignature,
            resolution: request.resolution,
            aspectRatio: request.aspectRatio,
          },
        };
      }
    }
    
    throw new ProviderError('No image data found in Gemini response', 'PARSE_ERROR');
  }
  
  /**
   * Check if resolution is supported by this model
   */
  private isResolutionSupported(resolution: ResolutionPreset): boolean {
    const modelMaxPixels = RESOLUTION_PRESETS[this.capabilities.maxResolution];
    const requestedPixels = RESOLUTION_PRESETS[resolution];
    return requestedPixels <= modelMaxPixels;
  }
  
  /**
   * Get image dimensions from ArrayBuffer
   */
  private getImageDimensions(
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
}

/**
 * Calculate points cost multiplier based on resolution
 */
export function getResolutionPointsMultiplier(resolution: ResolutionPreset): number {
  switch (resolution) {
    case '1K':
      return 1.0;
    case '2K':
      return 1.5;
    case '4K':
      return 2.0;
    default:
      return 1.0;
  }
}

/**
 * Calculate total points cost for Gemini image generation
 */
export function calculateGeminiPointsCost(
  basePointsCost: number,
  resolution: ResolutionPreset
): number {
  const multiplier = getResolutionPointsMultiplier(resolution);
  return Math.ceil(basePointsCost * multiplier);
}
