/**
 * Feature: model-config-settings
 * Shared provider config route contract
 * Validates: super-admin managed shared provider access
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/provider-configs/route';
import {
  createAuthenticatedClient,
  createServiceClient,
  getUserAdminFlags,
} from '@/lib/supabase/server';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';
import { encryptApiKey, getApiKeyLast4 } from '@/lib/security/encryption';

vi.mock('@/lib/supabase/server', () => {
  class MockApiAuthError extends Error {}
  return {
    createAuthenticatedClient: vi.fn(),
    createServiceClient: vi.fn(),
    getUserAdminFlags: vi.fn(),
    ApiAuthError: MockApiAuthError,
  };
});

vi.mock('@/lib/security/provider-revalidation', () => ({
  revalidateProviderConfigBeforeSave: vi.fn(),
}));

vi.mock('@/lib/security/encryption', () => ({
  encryptApiKey: vi.fn(),
  getApiKeyLast4: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/observability/metrics', () => ({
  trackMetric: vi.fn(),
}));

const createAuthenticatedClientMock = vi.mocked(createAuthenticatedClient);
const createServiceClientMock = vi.mocked(createServiceClient);
const getUserAdminFlagsMock = vi.mocked(getUserAdminFlags);
const revalidateProviderConfigBeforeSaveMock = vi.mocked(revalidateProviderConfigBeforeSave);
const encryptApiKeyMock = vi.mocked(encryptApiKey);
const getApiKeyLast4Mock = vi.mocked(getApiKeyLast4);

function buildRequest(method: 'GET' | 'POST', body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/provider-configs', {
    method,
    headers: {
      Authorization: 'Bearer token',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return query;
}

describe('provider-config routes contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthenticatedClientMock.mockResolvedValue({
      client: {} as never,
      user: { id: 'user-1' } as never,
    });
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: true });
    encryptApiKeyMock.mockResolvedValue('encrypted-test-key');
    getApiKeyLast4Mock.mockReturnValue('1234');
  });

  it('GET should return enabled shared configs to non-admin users', async () => {
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: false });

    const serviceClient = {
      from: vi.fn((table: string) => {
        if (table === 'user_profiles') {
          return createQuery({
            data: [{ id: 'admin-1' }],
            error: null,
          });
        }

        if (table === 'user_provider_configs_safe') {
          return createQuery({
            data: [
              {
                id: 'config-1',
                user_id: 'admin-1',
                provider: 'openai-compatible',
                api_url: 'https://api.example.com/v1',
                model_name: 'gpt-image-1',
                display_name: 'Shared Image',
                model_type: 'image',
                is_enabled: true,
                api_key_masked: '****1234',
                created_at: '2026-03-17T00:00:00.000Z',
                updated_at: '2026-03-17T00:00:00.000Z',
              },
            ],
            error: null,
          });
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createServiceClientMock.mockReturnValue(serviceClient as never);

    const response = await GET(buildRequest('GET'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [
        expect.objectContaining({
          id: 'config-1',
          user_id: 'admin-1',
          model_identifier: 'user:config-1',
        }),
      ],
      canManage: false,
    });
  });

  it('POST should reject non-admin users', async () => {
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: false });
    createServiceClientMock.mockReturnValue({} as never);

    const response = await POST(
      buildRequest('POST', {
        provider: 'openai-compatible',
        apiKey: 'sk-test-123',
        apiUrl: 'https://api.example.com/v1',
        modelName: 'gpt-4o-mini',
        displayName: 'Shared Brain',
        modelType: 'chat',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can manage shared provider configs',
      },
    });
    expect(revalidateProviderConfigBeforeSaveMock).not.toHaveBeenCalled();
  });

  it('POST should reject anthropic-compatible image configs', async () => {
    const response = await POST(
      buildRequest('POST', {
        provider: 'anthropic-compatible',
        apiKey: 'sk-test-123',
        apiUrl: 'https://api.minimaxi.com/anthropic',
        modelName: 'MiniMax-M2.7',
        displayName: 'MiniMax Brain',
        modelType: 'image',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: 'INVALID_MODEL_TYPE',
        message: 'Anthropic-compatible provider only supports chat modelType',
      },
    });
    expect(revalidateProviderConfigBeforeSaveMock).not.toHaveBeenCalled();
  });

  it('POST should create anthropic-compatible shared configs via the authenticated client after revalidation succeeds', async () => {
    revalidateProviderConfigBeforeSaveMock.mockResolvedValue({ success: true });

    const singleMock = vi.fn(() =>
      Promise.resolve({
        data: {
          id: 'config-2',
          user_id: 'user-1',
          provider: 'anthropic-compatible',
          api_url: 'https://api.minimaxi.com/anthropic',
          model_name: 'MiniMax-M2.7',
          display_name: 'MiniMax Brain',
          model_type: 'chat',
          is_enabled: true,
          api_key_last4: '1234',
          created_at: '2026-03-19T00:00:00.000Z',
          updated_at: '2026-03-19T00:00:00.000Z',
        },
        error: null,
      }),
    );
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const authenticatedFromMock = vi.fn((table: string) => {
      if (table === 'user_provider_configs') {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createAuthenticatedClientMock.mockResolvedValue({
      client: {
        from: authenticatedFromMock,
      } as never,
      user: { id: 'user-1' } as never,
    });
    createServiceClientMock.mockReturnValue({ from: vi.fn() } as never);

    const request = buildRequest('POST', {
      provider: 'anthropic-compatible',
      apiKey: 'sk-test-1234',
      apiUrl: 'https://api.minimaxi.com/anthropic',
      modelName: 'MiniMax-M2.7',
      displayName: 'MiniMax Brain',
      modelType: 'chat',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      data: {
        id: 'config-2',
        user_id: 'user-1',
        provider: 'anthropic-compatible',
        api_url: 'https://api.minimaxi.com/anthropic',
        model_name: 'MiniMax-M2.7',
        display_name: 'MiniMax Brain',
        model_type: 'chat',
        is_enabled: true,
        api_key_masked: '****1234',
        created_at: '2026-03-19T00:00:00.000Z',
        updated_at: '2026-03-19T00:00:00.000Z',
        model_identifier: 'user:config-2',
      },
    });
    expect(revalidateProviderConfigBeforeSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userClient: expect.objectContaining({ from: authenticatedFromMock }),
        serviceClient: expect.any(Object),
        userId: 'user-1',
        provider: 'anthropic-compatible',
        apiUrl: 'https://api.minimaxi.com/anthropic',
        modelName: 'MiniMax-M2.7',
        apiKey: 'sk-test-1234',
      }),
    );
    expect(createServiceClientMock).toHaveBeenCalledTimes(1);
    expect(authenticatedFromMock).toHaveBeenCalledWith('user_provider_configs');
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      provider: 'anthropic-compatible',
      api_key_encrypted: 'encrypted-test-key',
      api_key_last4: '1234',
      api_url: 'https://api.minimaxi.com/anthropic',
      model_name: 'MiniMax-M2.7',
      display_name: 'MiniMax Brain',
      model_type: 'chat',
      is_enabled: true,
    });
    expect(encryptApiKeyMock).toHaveBeenCalledWith('sk-test-1234');
    expect(getApiKeyLast4Mock).toHaveBeenCalledWith('sk-test-1234');
  });
});
