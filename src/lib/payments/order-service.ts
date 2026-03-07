/**
 * Payment Order Service
 * Handles order creation, status transitions, and queries.
 * All mutations go through service-role client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { generateOrderNo } from './order-no';
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderStatusResult,
  PaymentChannel,
  PaymentOrder,
  PaymentOrderStatus,
  PaymentProduct,
  PaymentProvider,
  ChannelAdapter,
} from './types';
import { isChannelAvailable } from './channels';

const ORDER_EXPIRY_MINUTES = 30;

const CHANNEL_TO_PROVIDER: Record<PaymentChannel, PaymentProvider> = {
  alipay_page: 'alipay',
  wechat_native: 'wechat',
  wechat_jsapi: 'wechat',
  unionpay: 'unionpay',
};

export class PaymentOrderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PaymentOrderError';
  }
}

/**
 * Create a payment order and initiate the first payment attempt.
 */
export async function createOrder(
  serviceClient: SupabaseClient,
  input: CreateOrderInput,
  adapter: ChannelAdapter,
  returnUrl: string
): Promise<CreateOrderResult> {
  const { data: product, error: productErr } = await serviceClient
    .from('payment_products')
    .select('*')
    .eq('code', input.product_code)
    .eq('is_enabled', true)
    .single();

  if (productErr || !product) {
    throw new PaymentOrderError(
      `Product "${input.product_code}" is not available`,
      'PRODUCT_UNAVAILABLE',
      400
    );
  }

  const typedProduct = product as PaymentProduct;

  if (!typedProduct.is_self_serve) {
    throw new PaymentOrderError(
      'This plan requires contacting sales',
      'PRODUCT_NOT_SELF_SERVE',
      400
    );
  }

  const channelOk = await isChannelAvailable(serviceClient, input.channel, input.scene);
  if (!channelOk) {
    throw new PaymentOrderError(
      `Channel "${input.channel}" is not available for scene "${input.scene}"`,
      'CHANNEL_UNAVAILABLE',
      400
    );
  }

  const orderNo = generateOrderNo();
  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const provider = CHANNEL_TO_PROVIDER[input.channel];

  const { data: order, error: orderErr } = await serviceClient
    .from('payment_orders')
    .insert({
      order_no: orderNo,
      user_id: input.user_id,
      product_id: typedProduct.id,
      provider,
      amount_fen: typedProduct.amount_fen,
      currency: typedProduct.currency,
      status: 'pending',
      expires_at: expiresAt,
      metadata: {
        channel: input.channel,
        scene: input.scene,
        scene_metadata: input.scene_metadata ?? {},
        product_snapshot: {
          code: typedProduct.code,
          title: typedProduct.display_config?.title ?? typedProduct.code,
          amount_fen: typedProduct.amount_fen,
          currency: typedProduct.currency,
          kind: typedProduct.kind,
          duration_days: typedProduct.duration_days,
          points_grant: typedProduct.points_grant,
        },
      },
    })
    .select()
    .single();

  if (orderErr || !order) {
    console.error('[Payments] Failed to create order:', orderErr);
    throw new PaymentOrderError('Failed to create payment order', 'ORDER_CREATE_FAILED', 500);
  }

  const typedOrder = order as PaymentOrder;
  const adapterResult = await adapter.createPayment(typedOrder, returnUrl);

  const { data: latestAttempt } = await serviceClient
    .from('payment_attempts')
    .select('attempt_no')
    .eq('order_id', typedOrder.id)
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const attemptNo = Number(latestAttempt?.attempt_no ?? 0) + 1;

  const { data: attempt, error: attemptErr } = await serviceClient
    .from('payment_attempts')
    .insert({
      order_id: typedOrder.id,
      provider,
      attempt_no: attemptNo,
      status: 'request_sent',
      request_payload: adapterResult.provider_payload,
      response_payload: adapterResult.provider_response,
    })
    .select()
    .single();

  if (attemptErr || !attempt) {
    console.error('[Payments] Failed to record payment attempt:', attemptErr);
    throw new PaymentOrderError('Failed to record payment attempt', 'ATTEMPT_CREATE_FAILED', 500);
  }

  return {
    order: typedOrder,
    attempt: attempt as CreateOrderResult['attempt'],
    channel_data: adapterResult.channel_data,
  };
}

/**
 * Get order with attempts by order_no.
 */
export async function getOrderByNo(
  serviceClient: SupabaseClient,
  orderNo: string
): Promise<OrderStatusResult | null> {
  const { data: order, error } = await serviceClient
    .from('payment_orders')
    .select('*')
    .eq('order_no', orderNo)
    .single();

  if (error || !order) return null;

  const { data: attempts } = await serviceClient
    .from('payment_attempts')
    .select('*')
    .eq('order_id', order.id)
    .order('attempt_no', { ascending: true });

  return {
    order: order as PaymentOrder,
    attempts: (attempts ?? []) as OrderStatusResult['attempts'],
  };
}

/**
 * Get order by id, scoped to a user.
 */
export async function getOrderForUser(
  serviceClient: SupabaseClient,
  orderId: string,
  userId: string
): Promise<PaymentOrder | null> {
  const { data, error } = await serviceClient
    .from('payment_orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as PaymentOrder;
}

/**
 * List orders for a user with optional status filter.
 */
export async function listUserOrders(
  serviceClient: SupabaseClient,
  userId: string,
  statusFilter?: PaymentOrderStatus,
  limit = 20
): Promise<PaymentOrder[]> {
  let query = serviceClient
    .from('payment_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data } = await query;
  return (data ?? []) as PaymentOrder[];
}

/**
 * Transition an order to a terminal status.
 * Returns the updated order, or null if the transition was invalid (already settled).
 */
export async function transitionOrderStatus(
  serviceClient: SupabaseClient,
  orderNo: string,
  toStatus: Extract<PaymentOrderStatus, 'paid' | 'expired' | 'failed' | 'canceled' | 'refunded'>,
  extra: Partial<Pick<PaymentOrder, 'provider_transaction_id' | 'paid_at'>> = {}
): Promise<PaymentOrder | null> {
  const { data, error } = await serviceClient
    .from('payment_orders')
    .update({
      status: toStatus,
      ...extra,
      updated_at: new Date().toISOString(),
    })
    .eq('order_no', orderNo)
    .in('status', ['created', 'pending'])
    .select()
    .single();

  if (error) {
    console.warn('[Payments] Order transition failed (may already be settled):', orderNo, error.message);
    return null;
  }

  return data as PaymentOrder;
}
