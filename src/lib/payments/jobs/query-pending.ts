/**
 * Query Pending Orders Job
 * Actively queries payment providers for orders stuck in pending state.
 * Settles orders that the provider reports as paid.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getAdapterByProvider } from '../adapter-factory';
import { fulfillOrder } from '../fulfillment';
import type { PaymentOrder } from '../types';

export async function queryPendingOrders(
  serviceClient: SupabaseClient
): Promise<{ queried: number; settled: number }> {
  // Find pending orders older than 2 minutes (give normal flow time to settle)
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: orders, error } = await serviceClient
    .from('payment_orders')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .gt('expires_at', now)
    .limit(50);

  if (error || !orders?.length) {
    return { queried: 0, settled: 0 };
  }

  let settled = 0;

  for (const row of orders) {
    const order = row as PaymentOrder;
    try {
      const adapter = getAdapterByProvider(order.provider);
      const queryResult = await adapter.queryOrder(order.order_no);

      if (queryResult.paid) {
        const orderForFulfillment: PaymentOrder = {
          ...order,
          provider_transaction_id: queryResult.provider_transaction_id,
          paid_at: queryResult.paid_at ?? now,
        };

        const fulfillment = await fulfillOrder(serviceClient, orderForFulfillment, undefined, {
          source: 'query_pending_job',
        });

        if (fulfillment.success) {
          settled++;
          console.log('[Job/QueryPending] Settled order:', order.order_no);
        }
      }
    } catch (err) {
      console.error('[Job/QueryPending] Error querying order:', order.order_no, err);
    }
  }

  return { queried: orders.length, settled };
}
