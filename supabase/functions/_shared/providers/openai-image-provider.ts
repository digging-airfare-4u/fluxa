/**
 * OpenAI Image Generation Provider
 * Implements ImageProvider interface for OpenAI Images API (gpt-image-2, etc.)
 * Uses OpenAICompatibleClient for HTTP communication.
 * API URL can be customized via system_settings (key: openai_image_api_url).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
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
// Direct fetch is used instead of OpenAICompatibleClient to support custom full endpoint URLs.

// ============================================================================
// Helpers
// ============================================================================

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ProviderError(`Failed to download image: ${response.status}`, 'DOWNLOAD_ERROR');
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const data = await response.arrayBuffer();
  return { data, contentType };
}

function getImageDimensions(data: ArrayBuffer, contentType: string): { width: number; height: number } | null {
  const bytes = new Uint8Array(data);

  if (contentType.includes('png') && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }

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

/**
 * Map aspect ratio to OpenAI size string.
 * gpt-image-2 supports: 1024x1024, 1024x1536, 1536x1024
 */
function aspectRatioToSize(aspectRatio?: AspectRatio): string {
  switch (aspectRatio) {
    case '16:9':
      return '1536x1024';
    case '9:16':
    case '3:4':
      return '1024x1536';
    case '4:3':
      return '1536x1024';
    case '1:1':
    default:
      return '1024x1024';
  }
}

// ============================================================================
// OpenAI Image Provider
// ============================================================================

export interface OpenAIImageProviderConfig {
  modelName: string;
  supabase: SupabaseClient;
}

export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai';
  readonly capabilities: ProviderCapabilities = {
    supportsImageToImage: false,
    maxResolution: '2K',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'] as readonly AspectRatio[],
  };

  private modelName: string;
  private supabase: SupabaseClient;

  constructor(config: OpenAIImageProviderConfig) {
    this.modelName = config.modelName;
    this.supabase = config.supabase;
  }

  async generate(request: ProviderRequest): Promise<ImageResult> {
    const apiKey = typeof Deno !== 'undefined' && Deno.env ? Deno.env.get('OPENAI_API_KEY') : undefined;
    if (!apiKey) {
      throw new ProviderError('OPENAI_API_KEY not configured', 'CONFIG_ERROR');
    }

    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new ProviderError(
        `Invalid request: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    const apiUrl = await this.getApiUrl();
    const size = aspectRatioToSize(request.aspectRatio);

    const body: Record<string, unknown> = {
      model: this.modelName,
      prompt: request.prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    console.log(`[OpenAIImage] Request URL: ${apiUrl}`);
    console.log(`[OpenAIImage] Model: ${this.modelName}, Size: ${size}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        errorMessage = await response.text();
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }
      throw new ProviderError(
        `OpenAI image API error: ${response.status} - ${errorMessage}`,
        'API_ERROR',
        { status: response.status, body: errorMessage },
        'openai',
        this.modelName,
        response.status
      );
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  validateRequest(request: ProviderRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }

    if (request.aspectRatio && !this.capabilities.supportedAspectRatios.includes(request.aspectRatio)) {
      errors.push(`Aspect ratio ${request.aspectRatio} is not supported`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get OpenAI image generation API URL from system_settings or fallback to official endpoint.
   * Returns the full endpoint URL (no suffix拼接).
   */
  private async getApiUrl(): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'openai_image_api_url')
        .single();

      if (!error && data?.value?.url) {
        return data.value.url.replace(/\/+$/, '');
      }
    } catch {
      // Fallback on any error
    }
    return 'https://api.openai.com/v1/images/generations';
  }

  private parseResponse(response: { data: Array<{ url?: string; b64_json?: string }> }): ImageResult {
    const imageData = response.data[0];
    if (!imageData) {
      throw new ProviderError('No image data in response', 'PARSE_ERROR');
    }

    if (imageData.b64_json) {
      const arrayBuffer = base64ToArrayBuffer(imageData.b64_json);
      const mimeType = 'image/png';
      const dimensions = getImageDimensions(arrayBuffer, mimeType);
      return {
        imageData: arrayBuffer,
        mimeType,
        width: dimensions?.width,
        height: dimensions?.height,
        metadata: { responseType: 'base64' },
      };
    }

    if (imageData.url) {
      throw new ProviderError('URL response format not supported in this implementation', 'PARSE_ERROR');
    }

    throw new ProviderError('Invalid response format: no url or b64_json', 'PARSE_ERROR');
  }
}
