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
  response_format?: 'url' | 'b64_json';
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
   * Send an image generation request in OpenAI format.
   * Requirements: 2.2
   */
  async imageGeneration(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
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

  // ==========================================================================
  // Private helpers
  // ==========================================================================

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
