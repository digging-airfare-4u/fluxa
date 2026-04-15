/**
 * OpenAI-Compatible HTTP Client
 * Shared client for sending OpenAI-format requests to any compatible endpoint.
 * Requirements: 1.2, 1.3, 2.2, 8.1, 8.2
 */

import { ProviderError } from '../errors/index.ts';
import type { ChatMessage, ChatCompletionOptions, ChatCompletionResult } from './chat-types.ts';

// ============================================================================
// Client Configuration
// ============================================================================

export interface OpenAIClientConfig {
  /** Base API URL (e.g., "https://api.openai.com/v1") */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Additional default headers to include in every request */
  defaultHeaders?: Record<string, string>;
  /** Provider name for error context */
  providerName?: string;
}

// ============================================================================
// Image Generation Types
// ============================================================================

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  aspect_ratio?: string;
  response_format?: 'url' | 'b64_json';
  subject_reference?: Array<{
    type: string;
    image_file: string;
  }>;
}

export interface ImageGenerationResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

// ============================================================================
// OpenAI-Compatible Client
// ============================================================================

export class OpenAICompatibleClient {
  private readonly config: OpenAIClientConfig;

  constructor(config: OpenAIClientConfig) {
    this.config = config;
  }

  /**
   * Send a chat completion request in OpenAI format.
   * Requirements: 1.2, 1.3
   */
  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.responseFormat !== undefined) {
      body.response_format = options.responseFormat;
    }

    const url = `${this.config.apiUrl}/chat/completions`;
    const response = await this.sendRequest(url, body);
    const data = await this.parseJSON(response);

    // Validate OpenAI chat response structure
    if (
      !data ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0 ||
      !data.choices[0]?.message?.content
    ) {
      throw new ProviderError(
        'Invalid response: missing choices[0].message.content',
        'INVALID_RESPONSE',
        { rawResponse: JSON.stringify(data) },
        this.config.providerName,
        model
      );
    }

    const choice = data.choices[0];
    const result: ChatCompletionResult = {
      content: choice.message.content,
      finishReason: choice.finish_reason ?? undefined,
    };

    if (data.usage) {
      result.usage = {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      };
    }

    return result;
  }

  /**
   * Stream a chat completion response as an async iterable of text deltas.
   */
  async *chatCompletionStream(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    const url = `${this.config.apiUrl}/chat/completions`;
    const response = await this.sendRequest(url, body);

    if (!response.body) {
      throw new ProviderError(
        'Streaming response missing body',
        'EMPTY_RESPONSE',
        undefined,
        this.config.providerName,
        model,
        502,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawAnyDelta = false;

    const processLine = function* (line: string): Generator<string, void, unknown> {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) return;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      try {
        const event = JSON.parse(payload);
        const delta = event?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yield delta;
        }
      } catch {
        // Ignore malformed SSE chunks.
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          // Flush any remaining buffered payload — some endpoints close without
          // a trailing newline on the final `data:` event.
          for (const line of buffer.split('\n')) {
            for (const delta of processLine(line)) {
              sawAnyDelta = true;
              yield delta;
            }
          }
          buffer = '';
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let lineEnd = buffer.indexOf('\n');
        while (lineEnd !== -1) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          lineEnd = buffer.indexOf('\n');

          for (const delta of processLine(line)) {
            sawAnyDelta = true;
            yield delta;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }

    if (!sawAnyDelta) {
      throw new ProviderError(
        'Chat provider streaming returned no content',
        'EMPTY_RESPONSE',
        undefined,
        this.config.providerName,
        model,
        502,
      );
    }
  }

  /**
   * Send an image generation request in OpenAI format.
   * Requirements: 2.2
   */
  async imageGeneration(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    if (this.isMiniMaxHost()) {
      return this.miniMaxImageGeneration(request);
    }

    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
    };

    if (request.n !== undefined) {
      body.n = request.n;
    }
    if (request.size !== undefined) {
      body.size = request.size;
    }
    if (request.response_format !== undefined) {
      body.response_format = request.response_format;
    }

    const url = `${this.config.apiUrl}/images/generations`;
    const response = await this.sendRequest(url, body);
    const data = await this.parseJSON(response);

    // Validate OpenAI image response structure
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new ProviderError(
        'Invalid response: missing data array',
        'INVALID_RESPONSE',
        { rawResponse: JSON.stringify(data) },
        this.config.providerName,
        request.model
      );
    }

    return { data: data.data };
  }

  private async miniMaxImageGeneration(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      n: request.n ?? 1,
    };

    const aspectRatio = request.aspect_ratio ?? this.resolveAspectRatioFromSize(request.size);
    if (aspectRatio) {
      body.aspect_ratio = aspectRatio;
    }

    if (request.response_format !== undefined) {
      body.response_format = request.response_format === 'b64_json' ? 'base64' : request.response_format;
    }

    if (request.subject_reference?.length) {
      body.subject_reference = request.subject_reference;
    }

    const response = await this.sendRequest(this.resolveMiniMaxImageUrl(), body);
    const data = await this.parseJSON(response);

    const statusCode = data?.base_resp?.status_code;
    if (typeof statusCode === 'number' && statusCode !== 0) {
      throw new ProviderError(
        data?.base_resp?.status_msg || 'MiniMax image generation failed',
        'API_ERROR',
        { rawResponse: JSON.stringify(data) },
        this.config.providerName,
        request.model,
      );
    }

    if (Array.isArray(data?.data?.image_base64) && data.data.image_base64.length > 0) {
      return {
        data: data.data.image_base64.map((item: string) => ({ b64_json: item })),
      };
    }

    if (Array.isArray(data?.data?.image_urls) && data.data.image_urls.length > 0) {
      return {
        data: data.data.image_urls.map((item: string) => ({ url: item })),
      };
    }

    throw new ProviderError(
      'Invalid MiniMax image response: missing image_urls or image_base64',
      'INVALID_RESPONSE',
      { rawResponse: JSON.stringify(data) },
      this.config.providerName,
      request.model,
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private isMiniMaxHost(): boolean {
    try {
      const hostname = new URL(this.config.apiUrl).hostname.toLowerCase();
      return hostname === 'api.minimaxi.com' || hostname === 'api.minimax.io';
    } catch {
      return false;
    }
  }

  private resolveMiniMaxImageUrl(): string {
    const baseUrl = this.config.apiUrl.replace(/\/+$/, '');
    if (baseUrl.endsWith('/v1')) {
      return `${baseUrl}/image_generation`;
    }
    return `${baseUrl}/v1/image_generation`;
  }

  private resolveAspectRatioFromSize(size?: string): string | undefined {
    if (!size) return undefined;

    const match = size.match(/^(\d+)x(\d+)$/);
    if (!match) return undefined;

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return undefined;
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Send a POST request with auth headers.
   * Throws ProviderError on HTTP errors (Requirements: 8.1).
   */
  private async sendRequest(
    url: string,
    body: Record<string, unknown>
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.defaultHeaders,
    };

    const response = await fetch(url, {
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
        `Provider API error: ${response.status} - ${errorMessage}`,
        'API_ERROR',
        { status: response.status, body: errorMessage },
        this.config.providerName,
        undefined,
        response.status
      );
    }

    return response;
  }

  /**
   * Parse JSON from response.
   * Throws ProviderError on parse failures (Requirements: 8.2).
   */
  // deno-lint-ignore no-explicit-any
  private async parseJSON(response: Response): Promise<any> {
    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      throw new ProviderError(
        'Failed to read response body',
        'INVALID_RESPONSE',
        undefined,
        this.config.providerName
      );
    }

    try {
      return JSON.parse(rawText);
    } catch {
      throw new ProviderError(
        'Invalid JSON in response',
        'INVALID_RESPONSE',
        { rawResponse: rawText },
        this.config.providerName
      );
    }
  }
}
