/**
 * Payment Domain Type Definitions
 * Aligned with CN web payments migrations.
 */

export type PaymentProductKind = 'membership' | 'points';

export type PaymentOrderStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'canceled';

export type PaymentChannel =
  | 'alipay_page'
  | 'wechat_native'
  | 'wechat_jsapi'
  | 'unionpay';

export type PaymentAttemptStatus = 'created' | 'request_sent' | 'provider_accepted' | 'failed';

export type RefundStatus = 'requested' | 'processing' | 'succeeded' | 'failed';

export type PaymentProvider = 'alipay' | 'wechat' | 'unionpay';

export type CheckoutScene = 'desktop' | 'mobile_browser' | 'wechat_browser';

export type MembershipLevel = 'free' | 'pro' | 'team';

export interface PaymentProduct {
  id: string;
  code: string;
  kind: PaymentProductKind;
  target_level: MembershipLevel | null;
  duration_days: number | null;
  points_grant: number;
  amount_fen: number;
  currency: string;
  is_self_serve: boolean;
  is_enabled: boolean;
  display_config: PaymentProductDisplayConfig;
  created_at: string;
  updated_at: string;
}

export interface PaymentProductDisplayConfig {
  title?: string;
  description?: string;
  badge?: string;
  [key: string]: unknown;
}

export interface PaymentOrder {
  id: string;
  order_no: string;
  user_id: string;
  product_id: string;
  provider: PaymentProvider;
  status: PaymentOrderStatus;
  amount_fen: number;
  currency: string;
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  order_id: string;
  provider: PaymentProvider;
  attempt_no: number;
  status: PaymentAttemptStatus;
  provider_request_id: string | null;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentProvider;
  provider_event_id: string;
  order_no: string | null;
  payload: Record<string, unknown>;
  signature: string | null;
  verified: boolean;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PaymentRefund {
  id: string;
  order_id: string;
  refund_no: string;
  provider_refund_id: string | null;
  amount_fen: number;
  status: RefundStatus;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChannelConfig {
  enabled: boolean;
  label: string;
  label_en: string;
  scenes: CheckoutScene[];
}

export type PaymentChannelsConfig = Record<PaymentChannel, ChannelConfig>;

export interface CreateOrderInput {
  user_id: string;
  product_code: string;
  channel: PaymentChannel;
  scene: CheckoutScene;
  scene_metadata?: Record<string, unknown>;
}

export interface CreateOrderResult {
  order: PaymentOrder;
  attempt: PaymentAttempt;
  channel_data: Record<string, unknown>;
}

export interface OrderStatusResult {
  order: PaymentOrder;
  attempts: PaymentAttempt[];
}

export interface AvailableChannelsResult {
  scene: CheckoutScene;
  channels: Array<{
    channel: PaymentChannel;
    label: string;
    label_en: string;
  }>;
}

export interface RefundInput {
  order_id: string;
  amount_fen: number;
  reason?: string;
}

export interface ChannelAdapterCreateResult {
  provider_payload: Record<string, unknown>;
  provider_response: Record<string, unknown>;
  channel_data: Record<string, unknown>;
}

export interface ChannelAdapterVerifyResult {
  valid: boolean;
  order_no: string | null;
  provider_transaction_id: string | null;
  paid_at: string | null;
  parsed_data: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly provider: PaymentProvider;
  readonly channel: PaymentChannel;

  createPayment(order: PaymentOrder, returnUrl: string): Promise<ChannelAdapterCreateResult>;

  verifyNotification(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<ChannelAdapterVerifyResult>;

  queryOrder(orderNo: string): Promise<{
    paid: boolean;
    provider_transaction_id: string | null;
    paid_at: string | null;
  }>;

  refund(
    orderNo: string,
    refundNo: string,
    totalAmountFen: number,
    refundAmountFen: number,
    reason?: string
  ): Promise<{
    provider_refund_id: string;
    status: 'processing' | 'succeeded' | 'failed';
  }>;
}

// Legacy provider-adapter contract (kept for compatibility with providers/* and tests)
export interface ProviderCreateOrderInput {
  mode: 'sandbox' | 'production';
  orderNo: string;
  amountFen: number;
  subject: string;
  notifyUrl: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderCreateOrderResult {
  providerOrderId: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  formHtml?: string;
  channelType: 'redirect' | 'native_qr' | 'jsapi';
  jsapiPayload?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface ProviderVerifyWebhookInput {
  mode: 'sandbox' | 'production';
  headers: Record<string, string>;
  body: string;
}

export interface VerifiedWebhookPayload {
  providerEventId: string;
  orderNo: string;
  transactionId?: string;
  amountFen: number;
  paidAt?: string;
  raw: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  name: PaymentProvider;
  createOrder(input: ProviderCreateOrderInput): Promise<ProviderCreateOrderResult>;
  verifyWebhook(input: ProviderVerifyWebhookInput): Promise<VerifiedWebhookPayload>;
}
