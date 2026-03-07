/**
 * Feature: model-config-settings
 * API Route Contract Tests
 * Validates: Requirements 4.10, 8.6
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/test-provider/route';
import { createAuthenticatedClient, createServiceClient } from '@/lib/supabase/server';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';
import { trackMetric } from '@/lib/observability/metrics';

vi.mock('@/lib/supabase/server', () => {
  class MockApiAuthError extends Error {}
  return {
    createAuthenticatedClient: vi.fn(),
    createServiceClient: vi.fn(),
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
const revalidateProviderConfigBeforeSaveMock = vi.mocked(revalidateProviderConfigBeforeSave);
const trackMetricMock = vi.mocked(trackMetric);

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/test-provider', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/test-provider contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthenticatedClientMock.mockResolvedValue({
      client: {} as never,
      user: { id: 'user-1' } as never,
    });
    createServiceClientMock.mockReturnValue({} as never);
  });

  it('should return CONFIG_ID_REQUIRED when apiKey is omitted', async () => {
    const request = buildRequest({
      apiUrl: 'https://api.example.com/v1',
      apiKey: '   ',
      modelName: 'my-model',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: 'CONFIG_ID_REQUIRED',
        message: 'configId is required when apiKey is omitted',
      },
    });
    expect(revalidateProviderConfigBeforeSaveMock).not.toHaveBeenCalled();
  });

  it('should propagate ALLOWLIST_UNAVAILABLE with fail-closed metric', async () => {
    revalidateProviderConfigBeforeSaveMock.mockResolvedValue({
      success: false,
      status: 503,
      code: 'ALLOWLIST_UNAVAILABLE',
      message: 'Provider host allowlist is unavailable or empty. Please contact administrator.',
    });

    const request = buildRequest({
      apiUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test-12345678',
      modelName: 'my-model',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'ALLOWLIST_UNAVAILABLE',
        message: 'Provider host allowlist is unavailable or empty. Please contact administrator.',
      },
    });
    expect(trackMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'allowlist_fail_closed',
        user_id: 'user-1',
      }),
    );
  });
});
