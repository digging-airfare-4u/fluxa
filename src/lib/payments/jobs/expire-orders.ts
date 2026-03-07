/**
 * Expire Orders Job
 * Closes pending orders that have passed their expiration time.
 * Intended to be called periodically (e.g., every 5 minutes via cron).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export async function expirePendingOrders(
  serviceClient: SupabaseClient
): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  const { data, error } = await serviceClient
    .from('payment_orders')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'pending')
    .lt('expires_at', now)
    .select('order_no');

  if (error) {
    console.error('[Job/ExpireOrders] Failed:', error);
    return { expired: 0 };
  }

  const expired = data?.length ?? 0;
  if (expired > 0) {
    console.log(`[Job/ExpireOrders] Expired ${expired} orders:`, data?.map((o) => o.order_no));
  }

  return { expired };
}
