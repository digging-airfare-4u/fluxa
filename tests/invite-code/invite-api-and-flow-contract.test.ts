import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('invite code api and ui flow contract', () => {
  it('adds invite redemption api route and query helper usage', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/app/api/invite/redeem/route.ts'),
      'utf8',
    );

    expect(route).toContain('createAuthenticatedClient(request)');
    expect(route).toContain("redeemInviteCode(");
    expect(route).toContain("code: 'NOT_AUTHENTICATED'");
    expect(route).toContain("code: 'INVALID_REQUEST'");
    expect(route).toContain("code: 'INTERNAL_ERROR'");
    expect(route).toContain('membership_expires_at');

    const query = readFileSync(
      resolve(process.cwd(), 'src/lib/supabase/queries/invite-codes.ts'),
      'utf8',
    );
    expect(query).toContain("rpc('redeem_invite_code'");
    expect(query).toContain('clearPendingInviteCode');
    expect(query).toContain('shouldClearPendingInviteCode');
  });

  it('captures pending invite code during registration only', () => {
    const authPage = readFileSync(resolve(process.cwd(), 'src/app/auth/page.tsx'), 'utf8');
    const authDialog = readFileSync(resolve(process.cwd(), 'src/components/auth/AuthDialog.tsx'), 'utf8');

    expect(authPage).toContain('inviteCode');
    expect(authPage).toContain('pending_invite_code');
    expect(authPage).toContain('signUp');

    expect(authDialog).toContain('inviteCode');
    expect(authDialog).toContain('pending_invite_code');
    expect(authDialog).toContain('signUp');
  });

  it('attempts auto redeem in app layout and keeps failures non-blocking', () => {
    const appLayout = readFileSync(resolve(process.cwd(), 'src/app/app/layout.tsx'), 'utf8');

    expect(appLayout).toContain('pending_invite_code');
    expect(appLayout).toContain('/api/invite/redeem');
    expect(appLayout).toContain('clearPendingInviteCode');
    expect(appLayout).toContain('shouldClearPendingInviteCode');
    expect(appLayout).toContain('console.error');
  });

  it('adds manual redemption section on profile page', () => {
    const profile = readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8');

    expect(profile).toContain('Invite Code');
    expect(profile).toContain('/api/invite/redeem');
    expect(profile).toContain('ALREADY_REDEEMED');
    expect(profile).toContain('CODE_USED');
    expect(profile).toContain('CODE_EXPIRED');
    expect(profile).toContain('INVALID_CODE');
    expect(profile).toContain('membership_expires_at');
  });

  it('updates the validation script for UUID-based membership source checks', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/invite-code/validate-api.sh'), 'utf8');

    expect(script).toContain('membership_source_order_id matches the invite_code_redemptions.id UUID');
    expect(script).not.toContain('starts with invite_redemption:');
  });
});
