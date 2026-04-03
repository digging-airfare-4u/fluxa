import { NextRequest, NextResponse } from 'next/server';

import { ApiAuthError, createAuthenticatedClient } from '@/lib/supabase/server';
import { redeemReferralCode } from '@/lib/supabase/queries/referral-codes';

interface RedeemBody {
  referral_code?: string;
}

const BUSINESS_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'Referral code is invalid.',
  SELF_REFERRAL: 'You cannot use your own referral code.',
  ALREADY_REDEEMED: 'You have already used a referral code.',
  NOT_ELIGIBLE: 'Referral code is only available for newly registered users.',
  NOT_AUTHENTICATED: 'Authentication required.',
  INTERNAL_ERROR: 'Failed to redeem referral code.',
};

export async function POST(request: NextRequest) {
  try {
    const { client } = await createAuthenticatedClient(request);

    const body = (await request.json()) as RedeemBody;
    const referralCode = body.referral_code?.trim();

    if (!referralCode) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'referral_code is required' } },
        { status: 400 },
      );
    }

    const result = await redeemReferralCode(client, referralCode);

    if (result.ok) {
      return NextResponse.json({
        success: true,
        referrer_points: result.referrer_points,
        referee_points: result.referee_points,
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
