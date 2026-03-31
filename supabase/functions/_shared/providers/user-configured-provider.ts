/**
 * User-Configured Image Provider
 * Wraps OpenAICompatibleClient to implement ImageProvider for user BYOK configs.
 * Requirements: 5.2, 5.5
 */

import { ProviderError } from '../errors/index.ts';
import { OpenAICompatibleClient } from './openai-client.ts';
import type {
  ImageProvider,
  ImageResult,
  ProviderRequest,
  ProviderCapabilities,
  ValidationResult,
  AspectRatio,
} from './types.ts';
import type { UserProviderRecord } from '../services/user-provider.ts';

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
    throw new ProviderError(
      `Failed to download generated image: ${response.status}`,
      'DOWNLOAD_ERROR',
      undefined,
      'user-configured'
    );
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const data = await response.arrayBuffer();
  return { data, contentType };
}

/**
 * Map aspect ratio to OpenAI-compatible size string.
 * Falls back to 1024x1024 for unknown ratios.
 */
function resolveSize(request: ProviderRequest): string {
  if (request.width && request.height) {
    return `${request.width}x${request.height}`;
  }
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '4:3': '1024x768',
    '3:4': '768x1024',
  };
  return sizeMap[request.aspectRatio || '1:1'] || '1024x1024';
}

function buildSubjectReference(request: ProviderRequest): Array<{ type: string; image_file: string }> | undefined {
  if (!request.referenceImageUrl) {
    return undefined;
  }

  return [
    {
      type: 'character',
      image_file: request.referenceImageUrl,
    },
  ];
}

// ============================================================================
// UserConfiguredImageProvider
// ============================================================================

export class UserConfiguredImageProvider implements ImageProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    supportsImageToImage: false,
    maxResolution: '2K',
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'] as readonly AspectRatio[],
  };

  private client: OpenAICompatibleClient;
  private config: UserProviderRecord;

  constructor(client: OpenAICompatibleClient, config: UserProviderRecord) {
    this.client = client;
    this.config = config;
    this.name = `user-configured:${config.provider}`;
  }

  /**
   * Generate image via the user's configured OpenAI-compatible endpoint.
   * Requirements: 5.2
   */
  async generate(request: ProviderRequest): Promise<ImageResult> {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new ProviderError(
        `Invalid request: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR',
        undefined,
        this.name,
        this.config.model_name
      );
    }

    const size = resolveSize(request);

    console.log(`[UserConfiguredProvider] Generating with model=${this.config.model_name}, size=${size}`);

    const response = await this.client.imageGeneration({
      model: this.config.model_name,
      prompt: request.prompt,
      n: 1,
      size,
      aspect_ratio: request.aspectRatio,
      response_format: 'b64_json',
      subject_reference: buildSubjectReference(request),
    });

    const imageEntry = response.data[0];
    if (!imageEntry) {
      throw new ProviderError(
        'No image data in provider response',
        'PARSE_ERROR',
        undefined,
        this.name,
        this.config.model_name
      );
    }

    // Handle base64 response
    if (imageEntry.b64_json) {
      const arrayBuffer = base64ToArrayBuffer(imageEntry.b64_json);
      return {
        imageData: arrayBuffer,
        mimeType: 'image/png',
        metadata: {
          provider: this.config.provider,
          model: this.config.model_name,
          responseType: 'base64',
        },
      };
    }

    // Handle URL response
    if (imageEntry.url) {
      const { data, contentType } = await downloadImage(imageEntry.url);
      return {
        imageData: data,
        mimeType: contentType,
        metadata: {
          provider: this.config.provider,
          model: this.config.model_name,
          responseType: 'url',
        },
      };
    }

    throw new ProviderError(
      'Invalid response format: no url or b64_json',
      'PARSE_ERROR',
      undefined,
      this.name,
      this.config.model_name
    );
  }

  /**
   * Validate request against provider capabilities.
   */
  validateRequest(request: ProviderRequest): ValidationResult {
    const errors: string[] = [];
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }
    return { valid: errors.length === 0, errors };
  }
}
