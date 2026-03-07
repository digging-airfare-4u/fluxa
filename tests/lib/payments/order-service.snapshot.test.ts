import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOrder } from '@/lib/payments/order-service';
import { isChannelAvailable } from '@/lib/payments/channels';

vi.mock('@/lib/payments/channels', () => ({
  isChannelAvailable: vi.fn(),
}));

vi.mock('@/lib/payments/order-no', () => ({
  generateOrderNo: vi.fn(() => 'FXTESTORDERNO0000000001'),
}));

const isChannelAvailableMock = vi.mocked(isChannelAvailable);

describe('createOrder metadata snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isChannelAvailableMock.mockResolvedValue(true);
  });

  it('persists immutable product snapshot into order metadata', async () => {
    let insertedOrderPayload: Record<string, unknown> | null = null;

    const product = {
      id: 'prod-1',
      code: 'pro_monthly',
      kind: 'membership',
      target_level: 'pro',
      duration_days: 30,
      points_grant: 300,
      amount_fen: 9900,
      currency: 'CNY',
      is_self_serve: true,
      is_enabled: true,
      display_config: { title: 'Pro 月付' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const serviceClient = {
      from: (table: string) => {
        if (table === 'payment_products') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: product, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === 'payment_orders') {
          return {
            insert: (payload: Record<string, unknown>) => {
              insertedOrderPayload = payload;
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'order-id-1',
                      order_no: payload.order_no,
                      user_id: payload.user_id,
                      product_id: payload.product_id,
                      provider: payload.provider,
                      status: payload.status,
                      amount_fen: payload.amount_fen,
                      currency: payload.currency,
                      provider_order_id: null,
                      provider_transaction_id: null,
                      paid_at: null,
                      expires_at: payload.expires_at,
                      metadata: payload.metadata,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        if (table === 'payment_attempts') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'attempt-id-1',
                    order_id: 'order-id-1',
                    provider: 'alipay',
                    attempt_no: 1,
                    status: 'request_sent',
                    provider_request_id: null,
                    request_payload: {},
                    response_payload: {},
                    error_code: null,
                    error_message: null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    const adapter = {
      provider: 'alipay',
      channel: 'alipay_page',
      createPayment: async () => ({
        provider_payload: { req: true },
        provider_response: { ok: true },
        channel_data: { type: 'redirect', url: 'https://pay.example.com' },
      }),
      verifyNotification: async () => ({
        valid: false,
        order_no: null,
        provider_transaction_id: null,
        paid_at: null,
        parsed_data: {},
      }),
      queryOrder: async () => ({ paid: false, provider_transaction_id: null, paid_at: null }),
      refund: async () => ({ provider_refund_id: 'rf-1', status: 'processing' as const }),
    };

    await createOrder(
      serviceClient,
      {
        user_id: 'user-1',
        product_code: 'pro_monthly',
        channel: 'alipay_page',
        scene: 'desktop',
      },
      adapter,
      'https://example.com/return',
    );

    expect(insertedOrderPayload).not.toBeNull();
    const metadata = (insertedOrderPayload as { metadata?: Record<string, unknown> }).metadata;
    expect(metadata?.product_snapshot).toEqual({
      code: 'pro_monthly',
      title: 'Pro 月付',
      amount_fen: 9900,
      currency: 'CNY',
      kind: 'membership',
      duration_days: 30,
      points_grant: 300,
    });
  });
});
