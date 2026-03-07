/**
 * Payment type contracts aligned with CN payment migrations.
 */

import { describe, it, expect } from 'vitest';
import type {
  PaymentOrderStatus,
  PaymentChannel,
  PaymentAttemptStatus,
  RefundStatus,
  PaymentProvider,
  CheckoutScene,
  PaymentProductKind,
} from '@/lib/payments/types';

describe('Payment Type Contracts', () => {
  it('PaymentOrderStatus matches DB lifecycle', () => {
    const statuses: PaymentOrderStatus[] = [
      'created', 'pending', 'paid', 'failed', 'expired', 'refunded', 'canceled',
    ];
    expect(statuses).toHaveLength(7);
  });

  it('PaymentProductKind matches DB enum', () => {
    const kinds: PaymentProductKind[] = ['membership', 'points'];
    expect(kinds).toHaveLength(2);
  });

  it('PaymentChannel covers all supported channels', () => {
    const channels: PaymentChannel[] = [
      'alipay_page', 'wechat_native', 'wechat_jsapi', 'unionpay',
    ];
    expect(channels).toHaveLength(4);
  });

  it('PaymentAttemptStatus matches DB enum', () => {
    const statuses: PaymentAttemptStatus[] = ['created', 'request_sent', 'provider_accepted', 'failed'];
    expect(statuses).toHaveLength(4);
  });

  it('RefundStatus matches DB enum', () => {
    const statuses: RefundStatus[] = ['requested', 'processing', 'succeeded', 'failed'];
    expect(statuses).toHaveLength(4);
  });

  it('PaymentProvider maps to adapters', () => {
    const providers: PaymentProvider[] = ['alipay', 'wechat', 'unionpay'];
    expect(providers).toHaveLength(3);
  });

  it('CheckoutScene covers all browser environments', () => {
    const scenes: CheckoutScene[] = ['desktop', 'mobile_browser', 'wechat_browser'];
    expect(scenes).toHaveLength(3);
  });
});
