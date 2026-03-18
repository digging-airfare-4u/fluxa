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
});
