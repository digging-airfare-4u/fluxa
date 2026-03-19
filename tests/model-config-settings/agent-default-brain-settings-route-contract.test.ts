/**
 * Feature: model-config-settings
 * Agent default brain settings route contract
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/system-settings/agent-default-brain/route';
import {
  createAuthenticatedClient,
  createServiceClient,
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

const createAuthenticatedClientMock = vi.mocked(createAuthenticatedClient);
const createServiceClientMock = vi.mocked(createServiceClient);
const getUserAdminFlagsMock = vi.mocked(getUserAdminFlags);

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/system-settings/agent-default-brain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/system-settings/agent-default-brain contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthenticatedClientMock.mockResolvedValue({
      client: {} as never,
      user: { id: 'user-1' } as never,
    });
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: true });
  });

  it('rejects non-admin users', async () => {
    getUserAdminFlagsMock.mockResolvedValue({ isSuperAdmin: false });

    const response = await POST(buildRequest({ model: 'user:config-1' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can manage system settings',
      },
    });
  });

  it('upserts the hidden default agent brain model', async () => {
    const selectMock = vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn((table: string) => {
      if (table === 'system_settings') {
        return { upsert: upsertMock };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    createServiceClientMock.mockReturnValue({ from: fromMock } as never);

    const response = await POST(buildRequest({ model: 'user:config-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('system_settings');
    expect(upsertMock).toHaveBeenCalledWith({
      key: 'agent_default_brain_model',
      value: { model: 'user:config-1' },
      description: 'Default hidden Agent Brain model selection',
    });
  });
});
