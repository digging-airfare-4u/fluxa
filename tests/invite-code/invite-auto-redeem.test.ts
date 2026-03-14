import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

describe('invite auto redeem cleanup policy', () => {
  it('clears pending invite codes for terminal outcomes', async () => {
    const inviteCodeQueries = await import('@/lib/supabase/queries/invite-codes');

    expect(typeof inviteCodeQueries.shouldClearPendingInviteCode).toBe('function');

    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({ success: true, code: null }),
    ).toBe(true);
    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'INVALID_CODE' },
      }),
    ).toBe(true);
    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'CODE_USED' },
      }),
    ).toBe(true);
    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'CODE_EXPIRED' },
      }),
    ).toBe(true);
    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'ALREADY_REDEEMED' },
      }),
    ).toBe(true);
  });

  it('keeps pending invite codes for retryable failures', async () => {
    const inviteCodeQueries = await import('@/lib/supabase/queries/invite-codes');

    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'INTERNAL_ERROR' },
      }),
    ).toBe(false);
    expect(
      inviteCodeQueries.shouldClearPendingInviteCode({
        success: false,
        error: { code: 'NOT_AUTHENTICATED' },
      }),
    ).toBe(false);
    expect(inviteCodeQueries.shouldClearPendingInviteCode(null)).toBe(false);
  });
});
