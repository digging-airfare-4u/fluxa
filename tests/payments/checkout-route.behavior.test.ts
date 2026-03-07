import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/payments/checkout/route';
import { getServiceClient, getUserFromAuthHeader } from '@/lib/supabase/server';
import { getAdapter } from '@/lib/payments/adapter-factory';
import { createOrder } from '@/lib/payments/order-service';

vi.mock('@/lib/supabase/server', () => ({
  getServiceClient: vi.fn(),
  getUserFromAuthHeader: vi.fn(),
}));

vi.mock('@/lib/payments/adapter-factory', () => ({
  getAdapter: vi.fn(),
}));

vi.mock('@/lib/payments/order-service', () => ({
  createOrder: vi.fn(),
  PaymentOrderError: class PaymentOrderError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number = 400,
    ) {
      super(message);
      this.name = 'PaymentOrderError';
    }
  },
}));

const getServiceClientMock = vi.mocked(getServiceClient);
const getUserFromAuthHeaderMock = vi.mocked(getUserFromAuthHeader);
const getAdapterMock = vi.mocked(getAdapter);
const createOrderMock = vi.mocked(createOrder);

function buildCheckoutRequest() {
  return new NextRequest('http://localhost/api/payments/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
    },
    body: JSON.stringify({ product_code: 'pro_monthly', channel: 'alipay_page' }),
  });
}

describe('POST /api/payments/checkout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromAuthHeaderMock.mockResolvedValue({ id: 'user-1' });
    getAdapterMock.mockReturnValue({} as never);
    createOrderMock.mockResolvedValue({
      order: {
        id: 'order-id-1',
        order_no: 'PO123',
        status: 'pending',
        expires_at: new Date().toISOString(),
      },
      channel_data: { type: 'redirect', url: 'https://pay.example.com/__ORDER_NO__' },
    } as never);
  });

  it('returns PAYMENT_DISABLED when global payment switch is off', async () => {
    const serviceClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { value: { enabled: false } }, error: null }),
          }),
        }),
      }),
    };
    getServiceClientMock.mockReturnValue(serviceClient as never);

    const response = await POST(buildCheckoutRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: 'PAYMENT_DISABLED',
        message: 'Payments are currently disabled',
      },
    });
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});
