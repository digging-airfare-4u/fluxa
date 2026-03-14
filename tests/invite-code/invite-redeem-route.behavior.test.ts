import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/invite/redeem/route';
import {
  ApiAuthError,
  createAuthenticatedClient,
  getServiceClient,
} from '@/lib/supabase/server';
import { redeemInviteCode } from '@/lib/supabase/queries/invite-codes';

vi.mock('@/lib/supabase/server', () => ({
  ApiAuthError: class ApiAuthError extends Error {
    constructor(message: string = 'Authentication required') {
      super(message);
      this.name = 'ApiAuthError';
    }
  },
  createAuthenticatedClient: vi.fn(),
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/queries/invite-codes', () => ({
  redeemInviteCode: vi.fn(),
}));

const createAuthenticatedClientMock = vi.mocked(createAuthenticatedClient);
const getServiceClientMock = vi.mocked(getServiceClient);
const redeemInviteCodeMock = vi.mocked(redeemInviteCode);

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/invite/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/invite/redeem behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the authenticated client for RPC redemption', async () => {
    const authenticatedClient = { rpc: vi.fn() } as never;

    createAuthenticatedClientMock.mockResolvedValue({
      client: authenticatedClient,
      user: { id: 'user-1', email: 'user@example.com' },
    });
    redeemInviteCodeMock.mockResolvedValue({
      ok: true,
      code: null,
      membership_expires_at: '2026-04-10T00:00:00.000Z',
    });

    const response = await POST(buildRequest({ invite_code: 'INVITE-30' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: null,
      membership_expires_at: '2026-04-10T00:00:00.000Z',
    });
    expect(createAuthenticatedClientMock).toHaveBeenCalledTimes(1);
    expect(redeemInviteCodeMock).toHaveBeenCalledWith(authenticatedClient, 'INVITE-30');
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns NOT_AUTHENTICATED when auth header is invalid', async () => {
    createAuthenticatedClientMock.mockRejectedValue(new ApiAuthError());

    const response = await POST(buildRequest({ invite_code: 'INVITE-30' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required.',
      },
    });
    expect(redeemInviteCodeMock).not.toHaveBeenCalled();
  });
});
