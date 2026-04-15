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
  chatCompletionStream?(model: string, messages: ChatMessage[], options?: ChatCompletionOptions): AsyncGenerator<string, void, unknown>;
}

export class UserConfiguredChatProvider implements ChatProvider {
  readonly name: string;
  // Only mounted when the underlying client supports streaming. The agent
  // executor uses `chatCompletionStream` presence to decide between the
  // streaming path and the single-chunk fallback, so non-streaming clients
  // must not expose this method at all.
  readonly chatCompletionStream?: (
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ) => AsyncGenerator<string, void, unknown>;

  constructor(
    private readonly client: UserConfiguredChatClient,
    private readonly config: UserProviderRecord,
  ) {
    this.name = `user-configured:${config.provider}`;
    if (typeof client.chatCompletionStream === 'function') {
      const stream = client.chatCompletionStream.bind(client);
      this.chatCompletionStream = async function* (
        this: UserConfiguredChatProvider,
        messages: ChatMessage[],
        options?: ChatCompletionOptions,
      ) {
        yield* stream(
          this.config.model_name,
          this.normalize(messages),
          options,
        );
      };
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    return this.client.chatCompletion(
      this.config.model_name,
      this.normalize(messages),
      options,
    );
  }

  private normalize(messages: ChatMessage[]): ChatMessage[] {
    return this.config.provider === 'volcengine'
      ? messages.map((message) => ({
        ...message,
        content: typeof message.content === 'string'
          ? [{ type: 'text' as const, text: message.content }]
          : message.content,
      }))
      : messages;
  }
}
