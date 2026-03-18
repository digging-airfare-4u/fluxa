/**
 * Feature: model-config-settings
 * Shared provider config by-id route contract
 * Validates: super-admin only mutations on shared configs
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '@/app/api/provider-configs/[id]/route';
import {
  createAuthenticatedClient,
  getUserAdminFlags,
} from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => {
  class MockApiAuthError extends Error {}
  return {
    createAuthenticatedClient: vi.fn(),
    createServiceClient: vi.fn(),
    getUserAdminFlags: vi.fn(),
    ApiAuthError: MockApiAuthError,
  };
});

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
const getUserAdminFlagsMock = vi.mocked(getUserAdminFlags);

describe('provider-config by-id routes contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthenticatedClientMock.mockResolvedValue({
      client: {} as never,
      user: { id: 'user-1' } as never,
    });
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: false });
  });

  it('PATCH should reject non-admin users', async () => {
    const request = new NextRequest('http://localhost/api/provider-configs/config-1', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: 'Updated' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'config-1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can manage shared provider configs',
      },
    });
  });

  it('DELETE should reject non-admin users', async () => {
    const request = new NextRequest('http://localhost/api/provider-configs/config-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'config-1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can manage shared provider configs',
      },
    });
  });
});
