/**
 * Payment Refund Service
 * Handles refund creation, provider submission, and fulfillment rollback.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { rollbackFulfillment } from './fulfillment';
import { generateRefundNo } from './order-no';
import type {
  ChannelAdapter,
  PaymentOrder,
  PaymentRefund,
  RefundInput,
} from './types';

export class RefundError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'RefundError';
  }
}

/**
 * Create and submit a refund for a paid order.
 */
export async function createRefund(
  serviceClient: SupabaseClient,
  input: RefundInput,
  order: PaymentOrder,
  adapter: ChannelAdapter
): Promise<PaymentRefund> {
  if (order.status !== 'paid') {
    throw new RefundError(
      `Order ${order.order_no} is not in a refundable status (${order.status})`,
      'ORDER_NOT_REFUNDABLE'
    );
  }

  if (input.amount_fen > order.amount_fen) {
    throw new RefundError(
      'Refund amount exceeds order amount',
      'REFUND_AMOUNT_EXCEEDS'
    );
  }

  const refundNo = generateRefundNo();

  const { data: refund, error: refundErr } = await serviceClient
    .from('payment_refunds')
    .insert({
      order_id: order.id,
      refund_no: refundNo,
      amount_fen: input.amount_fen,
      reason: input.reason,
      status: 'requested',
      metadata: {},
    })
    .select()
    .single();

  if (refundErr || !refund) {
    console.error('[Refund] Failed to create refund record:', refundErr);
    throw new RefundError('Failed to create refund', 'REFUND_CREATE_FAILED', 500);
  }

  try {
    const providerResult = await adapter.refund(
      order.order_no,
      refundNo,
      order.amount_fen,
      input.amount_fen,
      input.reason
    );

    const mappedStatus = providerResult.status === 'succeeded' ? 'succeeded' : providerResult.status;
    const newStatus = mappedStatus === 'succeeded' ? 'succeeded' : mappedStatus === 'processing' ? 'processing' : 'failed';

    await serviceClient
      .from('payment_refunds')
      .update({
        status: newStatus,
        provider_refund_id: providerResult.provider_refund_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id);

    if (newStatus === 'succeeded') {
      const { data: product } = await serviceClient
        .from('payment_products')
        .select('kind, points_grant')
        .eq('id', order.product_id)
        .single();

      const kind = (product?.kind === 'membership' ? 'membership' : 'points') as 'membership' | 'points';
      const pointsGrant = Number(product?.points_grant ?? 0);

      await rollbackFulfillment(serviceClient, order, refundNo, pointsGrant, kind);

      await serviceClient
        .from('payment_orders')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', order.id);
    }
  } catch (err) {
    console.error('[Refund] Provider refund failed:', err);
    await serviceClient
      .from('payment_refunds')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', refund.id);

    throw new RefundError('Provider refund request failed', 'PROVIDER_REFUND_FAILED', 502);
  }

  const { data: finalRefund } = await serviceClient
    .from('payment_refunds')
    .select('*')
    .eq('id', refund.id)
    .single();

  return finalRefund as PaymentRefund;
}
