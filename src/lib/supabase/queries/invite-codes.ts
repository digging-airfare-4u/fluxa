import { supabase } from '../client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type InviteRedeemCode =
  | 'INVALID_CODE'
  | 'CODE_USED'
  | 'CODE_EXPIRED'
  | 'ALREADY_REDEEMED'
  | 'NOT_AUTHENTICATED'
  | 'INTERNAL_ERROR';

export interface InviteRedeemResult {
  ok: boolean;
  code: InviteRedeemCode | null;
  membership_expires_at: string | null;
}

export interface InviteRedeemApiPayload {
  success?: boolean;
  code?: InviteRedeemCode | null;
  error?: {
    code?: InviteRedeemCode | null | string;
  } | null;
}

const TERMINAL_INVITE_REDEEM_CODES = new Set<InviteRedeemCode>([
  'INVALID_CODE',
  'CODE_USED',
  'CODE_EXPIRED',
  'ALREADY_REDEEMED',
]);

export async function redeemInviteCode(
  serviceClient: SupabaseClient,
  inputCode: string,
): Promise<InviteRedeemResult> {
  const { data, error } = await serviceClient.rpc('redeem_invite_code', {
    input_code: inputCode,
  });

  if (error) {
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      membership_expires_at: null,
    };
  }

  const payload = (data ?? {}) as Partial<InviteRedeemResult>;
  return {
    ok: payload.ok === true,
    code: (payload.code as InviteRedeemCode | null | undefined) ?? null,
    membership_expires_at: payload.membership_expires_at ?? null,
  };
}

export function shouldClearPendingInviteCode(
  payload: InviteRedeemApiPayload | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.success === true) return true;

  const code = payload.error?.code ?? payload.code ?? null;
  return TERMINAL_INVITE_REDEEM_CODES.has(code as InviteRedeemCode);
}

export async function clearPendingInviteCode(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const nextMetadata = {
    ...(user.user_metadata ?? {}),
    pending_invite_code: null,
  };

  await supabase.auth.updateUser({
    data: nextMetadata,
  });
}
