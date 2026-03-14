import { NextRequest, NextResponse } from 'next/server';

import { ApiAuthError, createAuthenticatedClient } from '@/lib/supabase/server';
import { redeemInviteCode } from '@/lib/supabase/queries/invite-codes';

interface RedeemBody {
  invite_code?: string;
}

const BUSINESS_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'Invite code is invalid.',
  CODE_USED: 'Invite code has already been used.',
  CODE_EXPIRED: 'Invite code has expired.',
  ALREADY_REDEEMED: 'You already redeemed an invite reward.',
  NOT_AUTHENTICATED: 'Authentication required.',
  INTERNAL_ERROR: 'Failed to redeem invite code.',
};

export async function POST(request: NextRequest) {
  try {
    const { client } = await createAuthenticatedClient(request);

    const body = (await request.json()) as RedeemBody;
    const inviteCode = body.invite_code?.trim();

    if (!inviteCode) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'invite_code is required' } },
        { status: 400 },
      );
    }

    const result = await redeemInviteCode(client, inviteCode);

    if (result.ok) {
      return NextResponse.json({
        success: true,
        code: null,
        membership_expires_at: result.membership_expires_at,
      });
    }

    const code = result.code ?? 'INTERNAL_ERROR';
    const status = code === 'NOT_AUTHENTICATED' ? 401 : 200;

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message: BUSINESS_MESSAGES[code] ?? BUSINESS_MESSAGES.INTERNAL_ERROR,
        },
        membership_expires_at: null,
      },
      { status },
    );
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'NOT_AUTHENTICATED', message: BUSINESS_MESSAGES.NOT_AUTHENTICATED } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: BUSINESS_MESSAGES.INTERNAL_ERROR } },
      { status: 500 },
    );
  }
}
