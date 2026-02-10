/**
 * Anthropic Chat Adapter
 * Translates between OpenAI-format messages and Anthropic's native API format.
 * Requirements: 1.4
 */

import { ProviderError } from '../errors/index.ts';
import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicChatAdapter implements ChatProvider {
  readonly name = 'anthropic';
  private readonly model: string;
  private readonly apiKey: string;

  constructor(model: string) {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ProviderError(
        'Missing API key for Anthropic',
        'MISSING_API_KEY',
        undefined,
        'anthropic'
      );
    }

    this.model = model;
    this.apiKey = apiKey;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    // Extract system message(s) into Anthropic's top-level `system` field
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const systemText = systemMessages
      .map((m) => (typeof m.content === 'string' ? m.content : m.content.map((c) => c.text).join('\n')))
      .join('\n');

    // Build Anthropic-format messages (content must be string)
    const anthropicMessages = nonSystemMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : m.content.map((c) => c.text).join('\n'),
    }));

    // Build request body
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
    };

    if (systemText) {
      body.system = systemText;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    // Send request with Anthropic-specific headers
    const response = await fetch(ANTHROPIC_API_URL, {
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
        `Anthropic API error: ${response.status} - ${errorMessage}`,
        'API_ERROR',
        { status: response.status, body: errorMessage },
        'anthropic',
        this.model,
        response.status
      );
    }

    // Parse response
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new ProviderError(
        'Invalid JSON in Anthropic response',
        'INVALID_RESPONSE',
        undefined,
        'anthropic',
        this.model
      );
    }

    // Translate Anthropic response → ChatCompletionResult
    const content = data.content as Array<{ type: string; text: string }> | undefined;
    if (!Array.isArray(content) || content.length === 0 || !content[0]?.text) {
      throw new ProviderError(
        'Invalid Anthropic response: missing content[0].text',
        'INVALID_RESPONSE',
        { rawResponse: JSON.stringify(data) },
        'anthropic',
        this.model
      );
    }

    const result: ChatCompletionResult = {
      content: content[0].text,
      finishReason: data.stop_reason as string | undefined,
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
