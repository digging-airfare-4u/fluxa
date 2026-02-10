/**
 * Volcengine (豆包) Chat Provider
 * OpenAI-compatible chat provider for Volcengine vision models.
 * Formats content as array for vision model compatibility.
 * Requirements: 1.5
 */

import { ProviderError } from '../errors/index.ts';
import { OpenAICompatibleClient } from './openai-client.ts';
import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';

const DEFAULT_VOLCENGINE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export class VolcengineChatProvider implements ChatProvider {
  readonly name = 'volcengine';
  private readonly model: string;
  private readonly client: OpenAICompatibleClient;

  constructor(model: string) {
    const apiKey = Deno.env.get('VOLCENGINE_API_KEY');
    if (!apiKey) {
      throw new ProviderError(
        'Missing API key for Volcengine',
        'MISSING_API_KEY',
        undefined,
        'volcengine'
      );
    }

    const apiUrl = Deno.env.get('VOLCENGINE_API_URL') || DEFAULT_VOLCENGINE_API_URL;

    this.model = model;
    this.client = new OpenAICompatibleClient({
      apiUrl,
      apiKey,
      providerName: 'volcengine',
    });
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    // Volcengine vision models require content as array format
    const formatted = messages.map((msg) => ({
      ...msg,
      content:
        typeof msg.content === 'string'
          ? [{ type: 'text' as const, text: msg.content }]
          : msg.content,
    }));

    return this.client.chatCompletion(this.model, formatted, options);
  }
}
