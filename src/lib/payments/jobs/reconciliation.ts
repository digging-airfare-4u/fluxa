/**
 * Reconciliation Export
 * Exports payment data for manual reconciliation and audit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReconciliationRecord {
  order_no: string;
  status: string;
  amount_fen: number;
  provider: string;
  provider_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  user_id: string;
  product_code: string;
  refund_count: number;
  refund_total_fen: number;
}

export async function exportReconciliation(
  serviceClient: SupabaseClient,
  dateFrom: string,
  dateTo: string
): Promise<ReconciliationRecord[]> {
  const { data: orders, error } = await serviceClient
    .from('payment_orders')
    .select('id, order_no, status, amount_fen, provider, provider_transaction_id, paid_at, created_at, user_id, product_id')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)
    .in('status', ['paid', 'refunded'])
    .order('created_at', { ascending: true });

  if (error || !orders?.length) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const productIds = Array.from(new Set(orders.map((o) => o.product_id)));

  const { data: refunds } = await serviceClient
    .from('payment_refunds')
    .select('order_id, amount_fen, status')
    .in('order_id', orderIds);

  const { data: products } = await serviceClient
    .from('payment_products')
    .select('id, code')
    .in('id', productIds);

  const productCodeById = new Map<string, string>((products ?? []).map((p) => [p.id, p.code]));

  const refundMap = new Map<string, { count: number; total: number }>();
  for (const r of refunds ?? []) {
    const existing = refundMap.get(r.order_id) ?? { count: 0, total: 0 };
    existing.count++;
    if (r.status === 'succeeded') existing.total += r.amount_fen;
    refundMap.set(r.order_id, existing);
  }

  return orders.map((o) => {
    const refundInfo = refundMap.get(o.id) ?? { count: 0, total: 0 };

    return {
      order_no: o.order_no,
      status: o.status,
      amount_fen: o.amount_fen,
      provider: o.provider,
      provider_transaction_id: o.provider_transaction_id,
      paid_at: o.paid_at,
      created_at: o.created_at,
      user_id: o.user_id,
      product_code: productCodeById.get(o.product_id) ?? '',
      refund_count: refundInfo.count,
      refund_total_fen: refundInfo.total,
    };
  });
}
