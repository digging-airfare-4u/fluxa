/**
 * Feature: model-config-settings
 * Provider connectivity contract tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testProviderConnectivityWithTimeout } from '@/lib/security/provider-connectivity';

const fetchMock = vi.fn();

describe('provider connectivity contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('probes anthropic-compatible endpoints via /v1/messages with anthropic headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await testProviderConnectivityWithTimeout({
      provider: 'anthropic-compatible',
      apiUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: 'sk-test',
      modelName: 'MiniMax-M2.7',
      timeoutMs: 12000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimaxi.com/anthropic/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
        }),
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      }),
    );
  });

  it('falls back to MiniMax native image_generation for image models on the MiniMax host', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ base_resp: { status_code: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await testProviderConnectivityWithTimeout({
      provider: 'openai-compatible',
      apiUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'sk-test',
      modelName: 'image-01',
      timeoutMs: 12000,
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.minimaxi.com/v1/image_generation',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'image-01',
          prompt: 'test',
          aspect_ratio: '1:1',
          n: 1,
        }),
      }),
    );
  });
});
