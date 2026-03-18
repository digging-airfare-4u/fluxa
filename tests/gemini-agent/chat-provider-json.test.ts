import { describe, expect, it, vi } from 'vitest';
import { callChatProviderJson } from '../../supabase/functions/_shared/utils/chat-provider-json.ts';

describe('callChatProviderJson', () => {
  it('parses the final JSON object when a reasoning model prefixes <think> content', async () => {
    const provider = {
      name: 'user-configured:openai-compatible',
      chatCompletion: vi.fn(async () => ({
        content: `<think>
The user wants me to respond with a specific JSON object: {"ok":true,"vendor":"minimax"}

I should only return that JSON object and nothing else.
</think>

{"ok":true,"vendor":"minimax"}`,
      })),
    };

    const result = await callChatProviderJson<{ ok: boolean; vendor: string }>({
      provider,
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toEqual({
      ok: true,
      vendor: 'minimax',
    });
    expect(provider.chatCompletion).toHaveBeenCalledWith(
      [{ role: 'user', content: 'test' }],
      expect.objectContaining({
        responseFormat: { type: 'json_object' },
      }),
    );
  });

  it('keeps parsing fenced json responses', async () => {
    const provider = {
      name: 'openai',
      chatCompletion: vi.fn(async () => ({
        content: '```json\n{"ok":true}\n```',
      })),
    };

    const result = await callChatProviderJson<{ ok: boolean }>({
      provider,
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toEqual({ ok: true });
  });
});
