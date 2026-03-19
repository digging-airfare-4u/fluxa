/**
 * Anthropic-Compatible HTTP Client
 * Sends Anthropic Messages-compatible requests to a configured endpoint.
 */

import { ProviderError } from '../errors/index.ts';
import type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessageContentPart,
} from './chat-types.ts';

export interface AnthropicCompatibleClientConfig {
  apiUrl: string;
  apiKey: string;
  providerName?: string;
}

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

function stringifyContentPart(part: ChatMessageContentPart): string {
  if (part.type === 'text') {
    return part.text;
  }

  return part.image_url.url;
}

function messageContentToText(content: ChatMessage['content']): string {
  return typeof content === 'string'
    ? content
    : content.map(stringifyContentPart).join('\n');
}

export class AnthropicCompatibleClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly providerName?: string;

  constructor(config: AnthropicCompatibleClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.providerName = config.providerName;
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const systemMessages = messages.filter((message) => message.role === 'system');
    const nonSystemMessages = messages.filter((message) => message.role !== 'system');

    const system = systemMessages.map((message) => messageContentToText(message.content)).join('\n');
    const anthropicMessages = nonSystemMessages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: messageContentToText(message.content),
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
    };

    if (system) {
      body.system = system;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${this.apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
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
        `Anthropic-compatible API error: ${response.status} - ${errorMessage}`,
        'API_ERROR',
        { status: response.status, body: errorMessage },
        this.providerName,
        model,
        response.status,
      );
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new ProviderError(
        'Invalid JSON in anthropic-compatible response',
        'INVALID_RESPONSE',
        undefined,
        this.providerName,
        model,
      );
    }

    const content = data.content as Array<{ type: string; text?: string }> | undefined;
    if (!Array.isArray(content) || content.length === 0 || !content[0]?.text) {
      throw new ProviderError(
        'Invalid anthropic-compatible response: missing content[0].text',
        'INVALID_RESPONSE',
        { rawResponse: JSON.stringify(data) },
        this.providerName,
        model,
      );
    }

    const result: ChatCompletionResult = {
      content: content[0].text,
      finishReason: typeof data.stop_reason === 'string' ? data.stop_reason : undefined,
    };

    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (usage) {
      result.usage = {
        promptTokens: usage.input_tokens ?? 0,
        completionTokens: usage.output_tokens ?? 0,
        totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      };
    }

    return result;
  }
}
