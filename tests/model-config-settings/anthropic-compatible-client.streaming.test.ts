/**
 * Feature: model-config-settings
 * Property: anthropic-compatible client streams text deltas from SSE responses.
 * Validates: Agent BYOK brains using Anthropic-compatible endpoints can render incrementally.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicCompatibleClient } from '../../supabase/functions/_shared/providers/anthropic-compatible-client.ts';
import type { ChatMessage } from '../../supabase/functions/_shared/providers/chat-types.ts';

describe('AnthropicCompatibleClient streaming', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        stream?: boolean;
        messages?: unknown[];
      };

      expect(requestBody.stream).toBe(true);
      expect(Array.isArray(requestBody.messages)).toBe(true);

      const encoder = new TextEncoder();
      const chunks = [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"，世界"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ];

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(chunks[0]));
          controller.enqueue(encoder.encode(chunks[1] + chunks[2].slice(0, 52)));
          controller.enqueue(encoder.encode(chunks[2].slice(52) + chunks[3] + chunks[4]));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it('yields incremental text deltas from named SSE events', async () => {
    const client = new AnthropicCompatibleClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      providerName: 'anthropic-compatible',
    });

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: '请逐步回复',
      },
    ];

    const deltas: string[] = [];
    for await (const delta of client.chatCompletionStream('claude-sonnet-4-20250514', messages)) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(['你好', '，世界']);
  });
});
