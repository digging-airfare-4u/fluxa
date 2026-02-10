/**
 * OpenAI Chat Provider
 * Direct OpenAI-compatible chat provider — passes messages through without modification.
 * Requirements: 1.6
 */

import { ProviderError } from '../errors/index.ts';
import { OpenAICompatibleClient } from './openai-client.ts';
import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';

export class OpenAIChatProvider implements ChatProvider {
  readonly name = 'openai';
  private readonly model: string;
  private readonly client: OpenAICompatibleClient;

  constructor(model: string) {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ProviderError(
        'Missing API key for OpenAI',
        'MISSING_API_KEY',
        undefined,
        'openai'
      );
    }

    this.model = model;
    this.client = new OpenAICompatibleClient({
      apiUrl: 'https://api.openai.com/v1',
      apiKey,
      providerName: 'openai',
    });
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    return this.client.chatCompletion(this.model, messages, options);
  }
}
