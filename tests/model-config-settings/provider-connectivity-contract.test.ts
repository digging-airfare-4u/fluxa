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
});
