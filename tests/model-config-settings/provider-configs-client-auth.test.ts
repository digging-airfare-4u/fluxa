/**
 * Feature: model-config-settings
 * Provider Config API Client Auth Contract
 * Validates: Requirements 2.4-2.6
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProviderConfig,
  fetchUserProviderConfigs,
  updateModelDefaults,
} from '@/lib/api/provider-configs';
import { supabase } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

const getSessionMock = vi.mocked(supabase.auth.getSession);
const refreshSessionMock = vi.mocked(supabase.auth.refreshSession);

describe('Provider configs API client auth contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should attach the current access token when fetching provider configs', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-123',
        },
      },
      error: null,
    } as never);
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await fetchUserProviderConfigs();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(url).toBe('/api/provider-configs');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('should refresh the session and send anthropic-compatible json when creating a provider config', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    } as never);
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-refreshed',
        },
      },
      error: null,
    } as never);
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'config-1',
            user_id: 'user-1',
            provider: 'anthropic-compatible',
            api_url: 'https://api.minimaxi.com/anthropic',
            model_name: 'MiniMax-M2.7',
            display_name: 'MiniMax Brain',
            model_type: 'chat',
            is_enabled: true,
            api_key_masked: '****1234',
            model_identifier: 'user:config-1',
            created_at: '2026-03-02T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await createProviderConfig({
      provider: 'anthropic-compatible',
      apiKey: 'sk-test',
      apiUrl: 'https://api.minimaxi.com/anthropic',
      modelName: 'MiniMax-M2.7',
      displayName: 'MiniMax Brain',
      modelType: 'chat',
    });

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(url).toBe('/api/provider-configs');
    expect(headers.get('Authorization')).toBe('Bearer token-refreshed');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe(
      JSON.stringify({
        provider: 'anthropic-compatible',
        apiKey: 'sk-test',
        apiUrl: 'https://api.minimaxi.com/anthropic',
        modelName: 'MiniMax-M2.7',
        displayName: 'MiniMax Brain',
        modelType: 'chat',
      }),
    );
  });

  it('should send authenticated json when updating model defaults', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-789',
        },
      },
      error: null,
    } as never);
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await updateModelDefaults({ agent_default_brain_model: 'user:config-1' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(url).toBe('/api/system-settings/model-defaults');
    expect(init?.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer token-789');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ agent_default_brain_model: 'user:config-1' }));
  });
});
