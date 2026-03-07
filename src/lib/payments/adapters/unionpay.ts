/**
 * UnionPay Adapter — Stub / Feature-flagged
 * Implements ChannelAdapter interface for future UnionPay integration.
 * All methods throw until the adapter is fully implemented and enabled.
 */

import type {
  ChannelAdapter,
  ChannelAdapterCreateResult,
  ChannelAdapterVerifyResult,
  PaymentOrder,
} from '../types';

export interface UnionPayConfig {
  merId: string;
  /** Signing certificate (pfx) path or buffer */
  signCert: string;
  signCertPassword: string;
  /** UnionPay encryption public key */
  encryptKey: string;
  notifyUrl: string;
  gateway?: string;
}

export class UnionPayNotEnabledError extends Error {
  constructor() {
    super('UnionPay payment channel is not yet enabled');
    this.name = 'UnionPayNotEnabledError';
  }
}

export class UnionPayAdapter implements ChannelAdapter {
  readonly provider = 'unionpay' as const;
  readonly channel = 'unionpay' as const;

  constructor(private _config: UnionPayConfig) {}

  async createPayment(
    _order: PaymentOrder,
    _returnUrl: string
  ): Promise<ChannelAdapterCreateResult> {
    throw new UnionPayNotEnabledError();
  }

  async verifyNotification(
    _rawBody: string,
    _headers: Record<string, string>
  ): Promise<ChannelAdapterVerifyResult> {
    throw new UnionPayNotEnabledError();
  }

  async queryOrder(_orderNo: string): Promise<{
    paid: boolean;
    provider_transaction_id: string | null;
    paid_at: string | null;
  }> {
    throw new UnionPayNotEnabledError();
  }

  async refund(
    _orderNo: string,
    _refundNo: string,
    _totalAmountFen: number,
    _refundAmountFen: number,
    _reason?: string
  ): Promise<{ provider_refund_id: string; status: 'processing' | 'succeeded' | 'failed' }> {
    throw new UnionPayNotEnabledError();
  }
}
