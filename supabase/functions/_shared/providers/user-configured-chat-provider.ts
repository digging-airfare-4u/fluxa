/**
 * User-Configured Chat Provider
 * Wraps OpenAICompatibleClient for BYOK chat/runtime usage.
 */

import { OpenAICompatibleClient } from './openai-client.ts';
import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';
import type { UserProviderRecord } from '../services/user-provider.ts';

export class UserConfiguredChatProvider implements ChatProvider {
  readonly name: string;

  constructor(
    private readonly client: OpenAICompatibleClient,
    private readonly config: UserProviderRecord,
  ) {
    this.name = `user-configured:${config.provider}`;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const normalizedMessages = this.config.provider === 'volcengine'
      ? messages.map((message) => ({
        ...message,
        content: typeof message.content === 'string'
          ? [{ type: 'text' as const, text: message.content }]
          : message.content,
      }))
      : messages;

    return this.client.chatCompletion(
      this.config.model_name,
      normalizedMessages,
      options,
    );
  }
}
