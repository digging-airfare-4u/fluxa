/**
 * User-Configured Chat Provider
 * Wraps a provider-specific BYOK chat client for runtime usage.
 */

import type {
  ChatProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from './chat-types.ts';
import type { UserProviderRecord } from '../services/user-provider.ts';

export interface UserConfiguredChatClient {
  chatCompletion(model: string, messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
}

export class UserConfiguredChatProvider implements ChatProvider {
  readonly name: string;

  constructor(
    private readonly client: UserConfiguredChatClient,
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
