/**
 * Gemini Image Generation Provider
 * Implements ImageProvider interface for Google Generative AI API
 * Supports dual mode: OpenAI-compatible (default) or native Gemini API
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ProviderError } from '../errors/index.ts';
import { OpenAICompatibleClient } from './openai-client.ts';
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
// Gemini Provider Configuration
// ============================================================================

/** API mode for Gemini image generation */
export type GeminiApiMode = 'openai' | 'native';

export interface GeminiProviderConfig {
  supabase: SupabaseClient;
  modelName: GeminiModelName;
  /** API mode: 'openai' for OpenAI-compatible endpoint (default), 'native' for Gemini generateContent API */
  mode?: GeminiApiMode;
}

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

function estimateBase64DecodedBytes(base64: string): number {
  const sanitized = base64.trim();
  if (sanitized.length === 0) return 0;

  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
}

const DEFAULT_INLINE_REFERENCE_MAX_BYTES = 4 * 1024 * 1024; // 4MB

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

/**
 * Gemini Provider for image generation
 * Supports dual mode:
 * - 'openai' (default): Uses OpenAICompatibleClient to call /v1/images/generations (e.g., via OpenRouter)
 * - 'native': Uses existing Gemini generateContent API directly
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export class GeminiProvider implements ImageProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  private readonly mode: GeminiApiMode;
  private readonly supabase: SupabaseClient;
  private readonly modelName: GeminiModelName;
  
  constructor(config: GeminiProviderConfig);
  /** @deprecated Use config object instead. Legacy two-arg constructor for backward compatibility. */
  constructor(supabase: SupabaseClient, modelName: GeminiModelName);
  constructor(
    configOrSupabase: GeminiProviderConfig | SupabaseClient,
    modelNameArg?: GeminiModelName
  ) {
    // Support both new config object and legacy (supabase, modelName) signatures
    if (modelNameArg !== undefined) {
      // Legacy constructor: GeminiProvider(supabase, modelName)
      this.supabase = configOrSupabase as SupabaseClient;
      this.modelName = modelNameArg;
      this.mode = this.resolveMode();
    } else {
      // New config constructor: GeminiProvider({ supabase, modelName, mode })
      const config = configOrSupabase as GeminiProviderConfig;
      this.supabase = config.supabase;
      this.modelName = config.modelName;
      this.mode = config.mode ?? this.resolveMode();
    }

    this.name = this.modelName;
    const modelConfig = GEMINI_MODELS[this.modelName];
    this.capabilities = {
      supportsImageToImage: modelConfig.supportsImageToImage,
      maxResolution: modelConfig.maxResolution,
      supportedAspectRatios: [...SUPPORTED_ASPECT_RATIOS],
    };
  }

  /**
   * Resolve API mode from environment variable.
   * Defaults to 'openai' if not set or invalid.
   */
  private resolveMode(): GeminiApiMode {
    const envMode = typeof Deno !== 'undefined' && Deno.env
      ? Deno.env.get('GEMINI_IMAGE_API_MODE')
      : undefined;
    if (envMode === 'native') return 'native';
    return 'openai';
  }
  
  /**
   * Generate image using the configured API mode
   * @throws ProviderError on generation failure
   */
  async generate(request: ProviderRequest): Promise<ImageResult> {
    // Validate request first
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new ProviderError(
        `Invalid request: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    console.log(`[Gemini] Mode: ${this.mode}, Model: ${this.modelName}`);

    if (this.mode === 'openai') {
      return this.generateViaOpenAI(request);
    }
    return this.generateViaNative(request);
  }

  // ==========================================================================
  // OpenAI-compatible mode (default)
  // ==========================================================================

  /**
   * Generate image via OpenAI-compatible endpoint (e.g., OpenRouter)
   * Requirements: 2.2
   */
  private async generateViaOpenAI(request: ProviderRequest): Promise<ImageResult> {
    const apiUrl = typeof Deno !== 'undefined' && Deno.env
      ? Deno.env.get('GEMINI_IMAGE_API_URL')
      : undefined;
    const apiKey = typeof Deno !== 'undefined' && Deno.env
      ? Deno.env.get('GEMINI_IMAGE_API_KEY')
      : undefined;

    if (!apiUrl) {
      throw new ProviderError(
        'GEMINI_IMAGE_API_URL not configured for OpenAI mode',
        'CONFIG_ERROR',
        undefined,
        'gemini'
      );
    }
    if (!apiKey) {
      throw new ProviderError(
        'GEMINI_IMAGE_API_KEY not configured for OpenAI mode',
        'MISSING_API_KEY',
        undefined,
        'gemini'
      );
    }

    // Strip trailing slash from apiUrl to avoid double-slash issues
    const normalizedUrl = apiUrl.replace(/\/+$/, '');

    const aspectRatio = request.aspectRatio || '1:1';
    const resolution = request.resolution || '1K';
    const dimensions = calculateDimensions(resolution as ResolutionPreset, aspectRatio as AspectRatio);

    // Use chat completions endpoint — most Gemini-compatible providers serve
    // image generation through /v1/chat/completions, not /v1/images/generations.
    // The model returns an image as base64 inline_data in the response.
    const chatUrl = `${normalizedUrl}/chat/completions`;

    console.log(`[Gemini] OpenAI mode: calling ${chatUrl}`);
    console.log(`[Gemini] Model: ${this.modelName}, Aspect: ${aspectRatio}, Resolution: ${resolution}`);

    // Build chat completion request with image generation prompt
    const chatBody: Record<string, unknown> = {
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    };

    // Add reference image if provided (image-to-image)
    if (request.referenceImageBase64 && request.referenceImageMimeType) {
      chatBody.messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${request.referenceImageMimeType};base64,${request.referenceImageBase64}`,
              },
            },
            {
              type: 'text',
              text: request.prompt,
            },
          ],
        },
      ];
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    console.log(`[Gemini] OpenAI chat request body keys:`, Object.keys(chatBody));

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(chatBody),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        errorMessage = await response.text();
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }
      console.error(`[Gemini] OpenAI chat error: ${response.status} - ${errorMessage}`);
      throw new ProviderError(
        `Provider API error: ${response.status} - ${errorMessage}`,
        'API_ERROR',
        { status: response.status, body: errorMessage },
        'gemini',
        this.modelName,
        response.status
      );
    }

    const data = await response.json();
    console.log(`[Gemini] OpenAI chat response received, parsing image...`);

    // Parse the chat completion response to extract image data.
    // The response may contain base64 image data in different formats depending on the provider:
    // 1. Standard OpenAI multimodal: choices[0].message.content as array with image parts
    // 2. Inline base64 in content string (data:image/...;base64,...)
    return this.parseChatImageResponse(data, dimensions, resolution, aspectRatio);
  }

  /**
   * Parse a chat completion response to extract image data.
   * Handles multiple response formats from different providers:
   * 1. Multimodal content array with inline_data (Gemini-style via OpenAI compat)
   * 2. Base64 data URL embedded in text content string
   * 3. Markdown image with base64 data URL
   */
  private parseChatImageResponse(
    data: Record<string, unknown>,
    dimensions: { width: number; height: number },
    resolution: string,
    aspectRatio: string
  ): ImageResult {
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (!choices || choices.length === 0) {
      console.error(`[Gemini] No choices in chat response:`, JSON.stringify(data).slice(0, 500));
      throw new ProviderError(
        'No choices in chat completion response',
        'INVALID_RESPONSE',
        undefined,
        'gemini',
        this.modelName
      );
    }

    const message = choices[0].message as Record<string, unknown> | undefined;
    if (!message) {
      throw new ProviderError(
        'No message in chat completion choice',
        'INVALID_RESPONSE',
        undefined,
        'gemini',
        this.modelName
      );
    }

    const content = message.content;

    // Case 1: content is an array (multimodal response with image parts)
    if (Array.isArray(content)) {
      for (const part of content) {
        // Check for inline_data (Gemini native format proxied through OpenAI compat)
        if (part.inline_data?.data) {
          const mimeType = part.inline_data.mimeType || 'image/png';
          const imageData = base64ToArrayBuffer(part.inline_data.data);
          const imgDimensions = this.getImageDimensions(imageData, mimeType);
          console.log(`[Gemini] Extracted image from inline_data, size: ${imageData.byteLength}`);
          return {
            imageData,
            mimeType,
            width: imgDimensions?.width ?? dimensions.width,
            height: imgDimensions?.height ?? dimensions.height,
            metadata: { mode: 'openai-chat', resolution, aspectRatio },
          };
        }
        // Check for image_url with base64 data
        if (part.type === 'image_url' && part.image_url?.url) {
          const dataUrl = part.image_url.url as string;
          const extracted = this.extractBase64FromDataUrl(dataUrl);
          if (extracted) {
            const imageData = base64ToArrayBuffer(extracted.base64);
            const imgDimensions = this.getImageDimensions(imageData, extracted.mimeType);
            console.log(`[Gemini] Extracted image from image_url part, size: ${imageData.byteLength}`);
            return {
              imageData,
              mimeType: extracted.mimeType,
              width: imgDimensions?.width ?? dimensions.width,
              height: imgDimensions?.height ?? dimensions.height,
              metadata: { mode: 'openai-chat', resolution, aspectRatio },
            };
          }
        }
      }
    }

    // Case 2: content is a string — look for embedded base64 data URL
    if (typeof content === 'string') {
      // Match data:image/...;base64,... pattern (possibly inside markdown ![](data:...))
      const dataUrlMatch = content.match(/data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)/);
      if (dataUrlMatch) {
        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];
        const imageData = base64ToArrayBuffer(base64Data);
        const imgDimensions = this.getImageDimensions(imageData, mimeType);
        console.log(`[Gemini] Extracted image from content string, size: ${imageData.byteLength}`);
        return {
          imageData,
          mimeType,
          width: imgDimensions?.width ?? dimensions.width,
          height: imgDimensions?.height ?? dimensions.height,
          metadata: { mode: 'openai-chat', resolution, aspectRatio },
        };
      }

      // Log what we got for debugging
      console.error(`[Gemini] Content is string but no image data found. First 500 chars:`, content.slice(0, 500));
    }

    console.error(`[Gemini] Could not extract image from response. Content type: ${typeof content}`);
    throw new ProviderError(
      'No image data found in chat completion response',
      'INVALID_RESPONSE',
      { contentType: typeof content, contentPreview: JSON.stringify(content).slice(0, 300) },
      'gemini',
      this.modelName
    );
  }

  /**
   * Extract base64 data and mime type from a data URL
   */
  private extractBase64FromDataUrl(url: string): { base64: string; mimeType: string } | null {
    const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
  }

  // ==========================================================================
  // Native Gemini API mode (fallback)
  // ==========================================================================

  /**
   * Generate image via native Gemini generateContent API
   * Requirements: 2.3
   */
  private async generateViaNative(request: ProviderRequest): Promise<ImageResult> {
    // Get API key from Deno env (only available in Deno runtime)
    const apiKey = typeof Deno !== 'undefined' && Deno.env ? Deno.env.get('GEMINI_API_KEY') : undefined;
    if (!apiKey) {
      throw new ProviderError('GEMINI_API_KEY not configured', 'CONFIG_ERROR');
    }

    const apiHost = await this.getApiHost();
    const normalizedHost = apiHost.replace(/\/+$/, '');
    const inlineReferenceMaxBytes = this.getInlineReferenceMaxBytes();
    let requestForProvider = request;
    let uploadedReferenceFileName: string | null = null;

    if (request.referenceImageBase64 && request.referenceImageMimeType) {
      const decodedBytes = estimateBase64DecodedBytes(request.referenceImageBase64);
      console.log(`[Gemini] Reference image size estimate: ${decodedBytes} bytes (inline max: ${inlineReferenceMaxBytes})`);

      if (decodedBytes > inlineReferenceMaxBytes) {
        console.log(`[Gemini] Reference image exceeds inline threshold, switching to Files API upload`);
        const uploadResult = await this.uploadReferenceImageToFilesApi(
          normalizedHost,
          apiKey,
          base64ToArrayBuffer(request.referenceImageBase64),
          request.referenceImageMimeType
        );

        uploadedReferenceFileName = uploadResult.name;
        requestForProvider = {
          ...request,
          referenceImageBase64: undefined,
          referenceImageFileUri: uploadResult.fileUri,
          referenceImageFileName: uploadResult.name,
          referenceImageMimeType: uploadResult.mimeType,
        };
      }
    }

    const resolution = request.resolution || '1K';
    const aspectRatio = request.aspectRatio || '1:1';
    const maxNoImageRetries = 1;
    const imageOnlyRetryPrompt = `${request.prompt}\n\nIMPORTANT: Return exactly one generated image. Do not return text.`;
    let attemptRequest = requestForProvider;
    
    try {
      for (let attempt = 0; attempt <= maxNoImageRetries; attempt++) {
        const requestBody = this.buildRequestBody(attemptRequest);

        console.log(`[Gemini] ========== NATIVE REQUEST START ==========`);
        console.log(`[Gemini] Attempt: ${attempt + 1}/${maxNoImageRetries + 1}`);
        console.log(`[Gemini] Model: ${this.modelName}`);
        console.log(`[Gemini] Resolution: ${resolution}`);
        console.log(`[Gemini] Aspect Ratio: ${aspectRatio}`);
        console.log(`[Gemini] Prompt: ${attemptRequest.prompt}`);
        console.log(`[Gemini] Has Reference Image: ${!!(attemptRequest.referenceImageBase64 || attemptRequest.referenceImageFileUri)}`);
        console.log(`[Gemini] Reference Image Mode: ${attemptRequest.referenceImageFileUri ? 'files-api' : 'inline'}`);
        console.log(`[Gemini] API Host: ${normalizedHost}`);
        console.log(`[Gemini] Request Body:`, JSON.stringify(requestBody, null, 2));
        console.log(`[Gemini] ========== NATIVE REQUEST END ==========`);

        const response = await fetch(
          `${normalizedHost}/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        console.log(`[Gemini] ========== NATIVE RESPONSE START ==========`);
        console.log(`[Gemini] Status: ${response.status} ${response.statusText}`);
        console.log(`[Gemini] Headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Gemini] Error Response Body:`, errorText);
          console.log(`[Gemini] ========== NATIVE RESPONSE END (ERROR) ==========`);
          throw new ProviderError(
            `Gemini API error: ${response.status}`,
            'API_ERROR',
            errorText
          );
        }

        const responseData = await response.json() as Record<string, unknown>;
        console.log(`[Gemini] Success Response Body:`, JSON.stringify(responseData, null, 2));
        console.log(`[Gemini] ========== NATIVE RESPONSE END ==========`);

        const rawCandidates = responseData.candidates;
        const candidates = Array.isArray(rawCandidates)
          ? rawCandidates as Array<Record<string, unknown>>
          : [];
        const hasNoImageFinishReason = candidates.some((candidate) => candidate.finishReason === 'NO_IMAGE');

        if (hasNoImageFinishReason) {
          if (attempt < maxNoImageRetries) {
            console.warn(`[Gemini] finishReason=NO_IMAGE, retrying with stricter image-only prompt`);
            attemptRequest = {
              ...attemptRequest,
              prompt: imageOnlyRetryPrompt,
            };
            continue;
          }

          throw new ProviderError(
            'Model returned NO_IMAGE (no image generated)',
            'NO_IMAGE_RESPONSE',
            responseData,
            'gemini',
            this.modelName
          );
        }

        return this.parseNativeResponse(responseData, attemptRequest);
      }

      throw new ProviderError('Image generation failed after retries', 'NO_IMAGE_RESPONSE', undefined, 'gemini', this.modelName);
    } finally {
      if (uploadedReferenceFileName) {
        await this.deleteUploadedReferenceFile(normalizedHost, apiKey, uploadedReferenceFileName);
      }
    }
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

  private getInlineReferenceMaxBytes(): number {
    const raw = typeof Deno !== 'undefined' && Deno.env
      ? Deno.env.get('GEMINI_INLINE_REFERENCE_MAX_BYTES')
      : undefined;

    if (!raw) return DEFAULT_INLINE_REFERENCE_MAX_BYTES;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_INLINE_REFERENCE_MAX_BYTES;
    }

    return Math.floor(parsed);
  }

  private async uploadReferenceImageToFilesApi(
    apiHost: string,
    apiKey: string,
    imageData: ArrayBuffer,
    mimeType: string
  ): Promise<{ name: string; fileUri: string; mimeType: string }> {
    const normalizedHost = apiHost.replace(/\/+$/, '');
    const uploadStartUrl = `${normalizedHost}/upload/v1beta/files?key=${apiKey}`;
    const imageBytes = new Uint8Array(imageData);

    const startResponse = await fetch(uploadStartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(imageBytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
      },
      body: JSON.stringify({
        file: {
          display_name: `fluxa-reference-${Date.now()}`,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorBody = await startResponse.text();
      throw new ProviderError(
        `Failed to start Gemini Files upload: ${startResponse.status}`,
        'FILES_UPLOAD_START_FAILED',
        errorBody,
        'gemini',
        this.modelName,
        startResponse.status
      );
    }

    const uploadUrl = startResponse.headers.get('x-goog-upload-url')
      || startResponse.headers.get('X-Goog-Upload-URL')
      || startResponse.headers.get('X-Goog-Upload-Url');

    if (!uploadUrl) {
      throw new ProviderError(
        'Missing resumable upload URL from Gemini Files API',
        'FILES_UPLOAD_START_FAILED',
        undefined,
        'gemini',
        this.modelName
      );
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
      },
      body: imageBytes,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      throw new ProviderError(
        `Failed to finalize Gemini Files upload: ${uploadResponse.status}`,
        'FILES_UPLOAD_FINALIZE_FAILED',
        errorBody,
        'gemini',
        this.modelName,
        uploadResponse.status
      );
    }

    const uploadData = await uploadResponse.json() as Record<string, unknown>;
    const fileNode = (uploadData.file as Record<string, unknown> | undefined) ?? uploadData;
    const name = typeof fileNode.name === 'string' ? fileNode.name : '';
    const fileUri = typeof fileNode.uri === 'string' ? fileNode.uri : '';
    const uploadedMimeType = typeof fileNode.mimeType === 'string' ? fileNode.mimeType : mimeType;

    if (!name || !fileUri) {
      throw new ProviderError(
        'Gemini Files API did not return file name/URI',
        'FILES_UPLOAD_INVALID_RESPONSE',
        uploadData,
        'gemini',
        this.modelName
      );
    }

    return { name, fileUri, mimeType: uploadedMimeType };
  }

  private async deleteUploadedReferenceFile(
    apiHost: string,
    apiKey: string,
    fileName: string
  ): Promise<void> {
    const normalizedHost = apiHost.replace(/\/+$/, '');
    const deleteUrl = `${normalizedHost}/v1beta/${fileName}?key=${apiKey}`;

    try {
      const response = await fetch(deleteUrl, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.text();
        console.warn(`[Gemini] Failed to delete uploaded reference file ${fileName}: ${response.status} ${body}`);
      }
    } catch (error) {
      console.warn(`[Gemini] Failed to delete uploaded reference file ${fileName}:`, error);
    }
  }
  
  /**
   * Build Gemini API request body
   */
  private buildRequestBody(request: ProviderRequest): Record<string, unknown> {
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
    const parts: Array<Record<string, unknown>> = [];
    
    // Prefer Files API references when available (for large inputs), otherwise inline base64.
    if (request.referenceImageFileUri && request.referenceImageMimeType) {
      parts.push({
        fileData: {
          mimeType: request.referenceImageMimeType,
          fileUri: request.referenceImageFileUri,
        },
      });
    } else if (request.referenceImageBase64 && request.referenceImageMimeType) {
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
      // Force image-only output to avoid text-only fallbacks from proxy providers.
      responseModalities: ['IMAGE'],
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
   * Parse native Gemini API response to extract image data
   */
  private parseNativeResponse(
    responseData: Record<string, unknown>,
    request: ProviderRequest
  ): ImageResult {
    console.log(`[Gemini] ========== PARSING RESPONSE ==========`);
    
    const candidates = responseData.candidates as Array<Record<string, unknown>> | undefined;
    console.log(`[Gemini] Candidates count: ${candidates?.length || 0}`);
    
    if (!candidates || candidates.length === 0) {
      console.error(`[Gemini] Parse Error: No candidates in response`);
      throw new ProviderError('No candidates in Gemini response', 'PARSE_ERROR');
    }

    const thoughtParts: string[] = [];
    const textParts: string[] = [];
    const thoughtSignatures: string[] = [];
    let foundImage: { mimeType: string; data: string; candidateIndex: number; partIndex: number } | null = null;

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
      const candidate = candidates[candidateIndex];
      const content = candidate.content as Record<string, unknown> | undefined;
      console.log(`[Gemini] Candidate ${candidateIndex} content exists: ${!!content}`);

      if (!content) continue;

      const parts = content.parts as Array<Record<string, unknown>> | undefined;
      console.log(`[Gemini] Candidate ${candidateIndex} parts count: ${parts?.length || 0}`);

      if (!parts || parts.length === 0) continue;

      for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        const part = parts[partIndex];
        console.log(`[Gemini] Candidate ${candidateIndex} part ${partIndex} keys:`, Object.keys(part));

        const inlineData = this.extractNativeInlineData(part);
        if (inlineData?.data && !foundImage) {
          foundImage = {
            mimeType: inlineData.mimeType || 'image/png',
            data: inlineData.data,
            candidateIndex,
            partIndex,
          };
        }

        const text = typeof part.text === 'string' ? part.text.trim() : '';
        if (text) {
          // Some providers return data URL in text payloads, keep this as a fallback.
          if (!foundImage) {
            const dataUrlImage = this.extractBase64ImageFromText(text);
            if (dataUrlImage) {
              foundImage = {
                mimeType: dataUrlImage.mimeType,
                data: dataUrlImage.base64,
                candidateIndex,
                partIndex,
              };
            }
          }

          if (part.thought === true) {
            thoughtParts.push(text);
          } else {
            textParts.push(text);
          }
        }

        const thoughtSignature =
          (typeof part.thoughtSignature === 'string' ? part.thoughtSignature : undefined) ||
          (typeof part.thought_signature === 'string' ? part.thought_signature : undefined);
        if (thoughtSignature) {
          thoughtSignatures.push(thoughtSignature);
        }
      }
    }

    if (foundImage) {
      console.log(`[Gemini] Found image in candidate ${foundImage.candidateIndex} part ${foundImage.partIndex}`);
      console.log(`[Gemini] MIME Type: ${foundImage.mimeType}`);
      console.log(`[Gemini] Base64 data length: ${foundImage.data.length} chars`);

      const imageData = base64ToArrayBuffer(foundImage.data);
      console.log(`[Gemini] ArrayBuffer size: ${imageData.byteLength} bytes`);

      const dimensions = this.getImageDimensions(imageData, foundImage.mimeType);
      console.log(`[Gemini] Dimensions: ${dimensions?.width}x${dimensions?.height}`);

      const result = {
        imageData,
        mimeType: foundImage.mimeType || 'image/png',
        width: dimensions?.width,
        height: dimensions?.height,
        metadata: {
          textResponse: textParts.join('\n\n') || undefined,
          thoughtSummary: thoughtParts.join('\n\n') || undefined,
          thoughtSignatures,
          resolution: request.resolution,
          aspectRatio: request.aspectRatio,
        },
      };

      console.log(`[Gemini] ========== PARSING SUCCESS ==========`);
      return result;
    }

    const textResponse = textParts.join('\n\n').trim();
    const thoughtSummary = thoughtParts.join('\n\n').trim();

    if (textResponse) {
      console.warn(`[Gemini] Parse Warning: Model returned text but no image data`);
      throw new ProviderError(
        textResponse,
        'TEXT_ONLY_RESPONSE',
        {
          textResponse,
          thoughtSummary: thoughtSummary || undefined,
          thoughtSignatures,
        },
        'gemini',
        this.modelName
      );
    }

    console.error(`[Gemini] Parse Error: No image data found in any part`);
    throw new ProviderError('No image data found in Gemini response', 'PARSE_ERROR', {
      thoughtSummary: thoughtSummary || undefined,
      thoughtSignatures,
    });
  }

  /**
   * Extract native inline image payload from camelCase/snake_case response variants.
   */
  private extractNativeInlineData(
    part: Record<string, unknown>
  ): { mimeType: string; data: string } | null {
    const inlineData = part.inlineData as Record<string, unknown> | undefined;
    if (inlineData && typeof inlineData.data === 'string' && inlineData.data.length > 0) {
      return {
        mimeType: (typeof inlineData.mimeType === 'string' ? inlineData.mimeType : 'image/png'),
        data: inlineData.data,
      };
    }

    const inlineDataSnake = part.inline_data as Record<string, unknown> | undefined;
    if (inlineDataSnake && typeof inlineDataSnake.data === 'string' && inlineDataSnake.data.length > 0) {
      return {
        mimeType:
          (typeof inlineDataSnake.mimeType === 'string' ? inlineDataSnake.mimeType :
            typeof inlineDataSnake.mime_type === 'string' ? inlineDataSnake.mime_type : 'image/png'),
        data: inlineDataSnake.data,
      };
    }

    return null;
  }

  /**
   * Extract base64 image from text payload (e.g., markdown/data URL fallback responses).
   */
  private extractBase64ImageFromText(
    text: string
  ): { mimeType: string; base64: string } | null {
    const match = text.match(/data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)/);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
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
