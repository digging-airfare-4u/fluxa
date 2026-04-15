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

interface AnthropicTextContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicImageContentBlock {
  type: 'image';
  source: {
    type: 'url';
    url: string;
  };
}

type AnthropicContentBlock = AnthropicTextContentBlock | AnthropicImageContentBlock;

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

function hasImageContentPart(parts: ChatMessageContentPart[]): boolean {
  return parts.some((part) => part.type === 'image_url');
}

function toAnthropicContentBlock(part: ChatMessageContentPart): AnthropicContentBlock {
  if (part.type === 'text') {
    return {
      type: 'text',
      text: part.text,
    };
  }

  return {
    type: 'image',
    source: {
      type: 'url',
      url: part.image_url.url,
    },
  };
}

function messageContentToAnthropic(
  content: ChatMessage['content'],
): string | AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return content;
  }

  if (!hasImageContentPart(content)) {
    return messageContentToText(content);
  }

  return content.map(toAnthropicContentBlock);
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
      content: messageContentToAnthropic(message.content),
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

    const contentBlocks = data.content as Array<{ type: string; text?: string }> | undefined;
    const textBlock = Array.isArray(contentBlocks)
      ? contentBlocks.find((b) => b.type === 'text' && b.text)
      : undefined;
    if (!textBlock?.text) {
      throw new ProviderError(
        'Invalid anthropic-compatible response: no text content block found',
        'INVALID_RESPONSE',
        { rawResponse: JSON.stringify(data) },
        this.providerName,
        model,
      );
    }

    const result: ChatCompletionResult = {
      content: textBlock.text,
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

  async *chatCompletionStream(
    model: string,
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const systemMessages = messages.filter((message) => message.role === 'system');
    const nonSystemMessages = messages.filter((message) => message.role !== 'system');

    const system = systemMessages.map((message) => messageContentToText(message.content)).join('\n');
    const anthropicMessages = nonSystemMessages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: messageContentToAnthropic(message.content),
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
      stream: true,
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

    if (!response.body) {
      throw new ProviderError(
        'Streaming response missing body',
        'EMPTY_RESPONSE',
        undefined,
        this.providerName,
        model,
        502,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawAnyDelta = false;

    const extractTextDelta = (payload: string): string | null => {
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string } | string;
          error?: { message?: string; type?: string };
        };

        if (event?.type === 'error') {
          const message = event.error?.message || 'Anthropic-compatible stream returned an error event';
          throw new ProviderError(
            message,
            'API_ERROR',
            { rawResponse: payload, type: event.error?.type },
            this.providerName,
            model,
            502,
          );
        }

        if (event?.type !== 'content_block_delta') {
          return null;
        }

        if (typeof event.delta === 'string') {
          return event.delta;
        }

        if (event.delta?.type === 'text_delta' && typeof event.delta.text === 'string') {
          return event.delta.text;
        }

        if (typeof event.delta?.text === 'string') {
          return event.delta.text;
        }

        return null;
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }
        return null;
      }
    };

    const flushEventBlocks = function* (
      pending: string,
    ): Generator<{ remaining: string; delta?: string }, void, unknown> {
      let rest = pending;
      let separatorIndex = rest.search(/\r?\n\r?\n/);

      while (separatorIndex !== -1) {
        const rawBlock = rest.slice(0, separatorIndex);
        const separatorLength = rest.startsWith('\r\n\r\n', separatorIndex) ? 4 : 2;
        rest = rest.slice(separatorIndex + separatorLength);

        const dataLines = rawBlock
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .filter(Boolean);

        if (dataLines.length > 0) {
          const delta = extractTextDelta(dataLines.join('\n'));
          if (delta) {
            yield { remaining: rest, delta };
          }
        }

        separatorIndex = rest.search(/\r?\n\r?\n/);
      }

      yield { remaining: rest };
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
        } else {
          buffer += decoder.decode(value, { stream: true });
        }

        for (const block of flushEventBlocks(buffer)) {
          buffer = block.remaining;
          if (block.delta) {
            sawAnyDelta = true;
            yield block.delta;
          }
        }

        if (done) {
          break;
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
        'Anthropic-compatible streaming returned no content',
        'EMPTY_RESPONSE',
        undefined,
        this.providerName,
        model,
        502,
      );
    }
  }
}
