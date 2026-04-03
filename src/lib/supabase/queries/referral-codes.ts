import { supabase } from '../client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ReferralRedeemCode =
  | 'INVALID_CODE'
  | 'SELF_REFERRAL'
  | 'ALREADY_REDEEMED'
  | 'NOT_ELIGIBLE'
  | 'NOT_AUTHENTICATED'
  | 'INTERNAL_ERROR';

export interface ReferralRedeemResult {
  ok: boolean;
  code: ReferralRedeemCode | null;
  referrer_points: number | null;
  referee_points: number | null;
}

export interface ReferralRedeemApiPayload {
  success?: boolean;
  code?: ReferralRedeemCode | null;
  error?: {
    code?: ReferralRedeemCode | null | string;
  } | null;
}

const TERMINAL_REFERRAL_CODES = new Set<ReferralRedeemCode>([
  'INVALID_CODE',
  'SELF_REFERRAL',
  'ALREADY_REDEEMED',
  'NOT_ELIGIBLE',
]);

/**
 * Redeem a referral code via authenticated Supabase client (server-side).
 */
export async function redeemReferralCode(
  serviceClient: SupabaseClient,
  inputCode: string,
): Promise<ReferralRedeemResult> {
  const { data, error } = await serviceClient.rpc('redeem_referral_code', {
    input_code: inputCode,
  });

  if (error) {
    return { ok: false, code: 'INTERNAL_ERROR', referrer_points: null, referee_points: null };
  }

  const payload = (data ?? {}) as Partial<ReferralRedeemResult>;
  return {
    ok: payload.ok === true,
    code: (payload.code as ReferralRedeemCode | null | undefined) ?? null,
    referrer_points: payload.referrer_points ?? null,
    referee_points: payload.referee_points ?? null,
  };
}

/**
 * Get or create the current user's referral code (client-side).
 */
export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_referral_code');
  if (error || !data?.ok) return null;
  return (data as { ok: boolean; referral_code: string }).referral_code;
}

/**
 * Whether we should clear the pending referral code from user metadata.
 */
export function shouldClearPendingReferralCode(
  payload: ReferralRedeemApiPayload | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.success === true) return true;
  const code = payload.error?.code ?? payload.code ?? null;
  return TERMINAL_REFERRAL_CODES.has(code as ReferralRedeemCode);
}

/**
 * Clear pending_referral_code from user metadata.
 */
export async function clearPendingReferralCode(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.auth.updateUser({
    data: { ...user.user_metadata, pending_referral_code: null },
  });
}

/**
 * localStorage key for persisting referral code across OAuth redirects.
 */
const REFERRAL_STORAGE_KEY = 'fluxa_pending_referral';

export function storeReferralCodeLocally(code: string): void {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch { /* noop */ }
}

export function getLocalReferralCode(): string | null {
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearLocalReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* noop */ }
}
