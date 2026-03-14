/**
 * Payment Fulfillment Service
 * Uses payment_fulfill_order RPC as the idempotent settlement path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { PaymentOrder } from './types';

export interface FulfillmentResult {
  success: boolean;
  already_fulfilled: boolean;
}

/**
 * Fulfill a paid order via migration-defined RPC.
 */
export async function fulfillOrder(
  serviceClient: SupabaseClient,
  order: PaymentOrder,
  providerEventId?: string,
  payload: Record<string, unknown> = {}
): Promise<FulfillmentResult> {
  const { data, error } = await serviceClient.rpc('payment_fulfill_order', {
    p_order_no: order.order_no,
    p_provider: order.provider,
    p_provider_transaction_id: order.provider_transaction_id,
    p_paid_amount_fen: order.amount_fen,
    p_paid_at: order.paid_at ?? new Date().toISOString(),
    p_provider_event_id: providerEventId ?? null,
    p_payload: payload,
  });

  if (error) {
    console.error('[Fulfillment] RPC error:', error);
    return { success: false, already_fulfilled: false };
  }

  const result = (data ?? {}) as { ok?: boolean; idempotent?: boolean };
  return {
    success: result.ok === true,
    already_fulfilled: result.idempotent === true,
  };
}

/**
 * Rollback fulfillment on refund: revert membership and claw back points.
 */
export async function rollbackFulfillment(
  serviceClient: SupabaseClient,
  order: PaymentOrder,
  refundNo: string,
  pointsGrant: number,
  kind: 'membership' | 'points'
): Promise<{ membership_rolled_back: boolean; points_rolled_back: boolean }> {
  const now = new Date().toISOString();
  let membershipRolledBack = false;
  let pointsRolledBack = false;

  if (kind === 'membership') {
    const { error } = await serviceClient
      .from('user_profiles')
      .update({
        membership_level: 'free',
        membership_expires_at: null,
        membership_source_order_id: null,
        membership_updated_at: now,
        updated_at: now,
      })
      .eq('id', order.user_id)
      .eq('membership_source_order_id', order.id);

    membershipRolledBack = !error;
  }

  if (pointsGrant > 0) {
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('points')
      .eq('id', order.user_id)
      .single();

    const currentPoints = profile?.points ?? 0;
    const newBalance = Math.max(0, currentPoints - pointsGrant);

    const { error: pointsErr } = await serviceClient
      .from('user_profiles')
      .update({ points: newBalance, updated_at: now })
      .eq('id', order.user_id);

    if (!pointsErr) {
      await serviceClient.from('point_transactions').insert({
        user_id: order.user_id,
        type: 'adjust',
        amount: -pointsGrant,
        source: 'payment_refund_rollback',
        reference_id: refundNo,
        balance_after: newBalance,
        payment_order_no: order.order_no,
        payment_provider: order.provider,
        payment_transaction_id: order.provider_transaction_id ?? '',
        metadata: { order_no: order.order_no, refund_no: refundNo },
      });
      pointsRolledBack = true;
    }
  }

  return { membership_rolled_back: membershipRolledBack, points_rolled_back: pointsRolledBack };
}
