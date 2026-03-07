/**
 * POST /api/payments/notify/alipay
 * Public endpoint for Alipay async payment notifications.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getAdapterByProvider } from '@/lib/payments/adapter-factory';
import { fulfillOrder } from '@/lib/payments/fulfillment';
import { getOrderByNo } from '@/lib/payments/order-service';
import { getServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const sc = getServiceClient();
  const rawBody = await request.text();
  const correlationId = crypto.randomUUID();

  try {
    const adapter = getAdapterByProvider('alipay');
    const verification = await adapter.verifyNotification(rawBody, {});
    const providerEventId = String(verification.parsed_data.notify_id ?? correlationId);

    if (!verification.valid) {
      return new NextResponse('fail', { status: 200 });
    }

    if (verification.order_no && verification.provider_transaction_id) {
      const orderResult = await getOrderByNo(sc, verification.order_no);

      if (orderResult) {
        const order = {
          ...orderResult.order,
          provider_transaction_id: verification.provider_transaction_id,
          paid_at: verification.paid_at ?? new Date().toISOString(),
        };

        await fulfillOrder(sc, order, providerEventId, {
          ...verification.parsed_data,
          signature: null,
          verified: verification.valid,
        });
      }

    }

    return new NextResponse('success', { status: 200 });
  } catch (err) {
    console.error('[Notify/Alipay] Processing error:', { correlationId, error: err });
    return new NextResponse('fail', { status: 200 });
  }
}
