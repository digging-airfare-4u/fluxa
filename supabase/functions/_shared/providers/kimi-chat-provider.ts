/**
 * Kimi (Moonshot) Chat Provider
 * Built-in system chat/brain provider backed by Kimi's Anthropic-compatible endpoint.
 * Auth uses a Bearer token (Kimi's `ANTHROPIC_AUTH_TOKEN`), host/key come from env secrets.
 */

import { ProviderError } from '../errors/index.ts';
import { AnthropicCompatibleClient } from './anthropic-compatible-client.ts';
import { DEFAULT_KIMI_API_URL } from '../defaults.ts';
import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';

export class KimiChatProvider implements ChatProvider {
  readonly name = 'kimi';
  private readonly model: string;
  private readonly client: AnthropicCompatibleClient;

  constructor(model: string) {
    const apiKey = Deno.env.get('KIMI_API_KEY');
    if (!apiKey) {
      throw new ProviderError(
        'Missing API key for Kimi',
        'MISSING_API_KEY',
        undefined,
        'kimi',
      );
    }

    this.model = model;
    this.client = new AnthropicCompatibleClient({
      apiUrl: Deno.env.get('KIMI_API_URL') || DEFAULT_KIMI_API_URL,
      apiKey,
      providerName: 'kimi',
      authScheme: 'bearer',
    });
  }

  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    return this.client.chatCompletion(this.model, messages, options);
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    yield* this.client.chatCompletionStream(this.model, messages, options);
  }
}
