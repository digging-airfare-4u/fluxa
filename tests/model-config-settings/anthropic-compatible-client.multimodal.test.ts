/**
 * Feature: model-config-settings
 * Property: anthropic-compatible client preserves multimodal image blocks.
 * Validates: Anthropic Messages API vision payloads stay structured.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCompatibleClient } from '../../supabase/functions/_shared/providers/anthropic-compatible-client.ts';
import type { ChatMessage } from '../../supabase/functions/_shared/providers/chat-types.ts';

describe('AnthropicCompatibleClient multimodal payloads', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 12,
        output_tokens: 8,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it('sends image_url parts as Anthropic image source blocks instead of flattening them into text', async () => {
    const client = new AnthropicCompatibleClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      providerName: 'anthropic-compatible',
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Follow the image carefully.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: 'https://cdn.example.com/reference.png',
            },
          },
          {
            type: 'text',
            text: 'Describe this image.',
          },
        ],
      },
    ];

    await client.chatCompletion('claude-sonnet-4-20250514', messages);

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      system?: string;
      messages: Array<{
        role: string;
        content: unknown;
      }>;
    };

    expect(body.system).toBe('Follow the image carefully.');
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: 'https://cdn.example.com/reference.png',
            },
          },
          {
            type: 'text',
            text: 'Describe this image.',
          },
        ],
      },
    ]);
  });
});
