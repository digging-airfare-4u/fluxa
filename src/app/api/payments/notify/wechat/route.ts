/**
 * POST /api/payments/notify/wechat
 * Public endpoint for WeChat Pay async payment notifications.
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
    const adapter = getAdapterByProvider('wechat');
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => {
      headers[k] = v;
    });

    const verification = await adapter.verifyNotification(rawBody, headers);
    const providerEventId = String(verification.parsed_data.transaction_id ?? correlationId);

    if (!verification.valid) {
      return NextResponse.json({ code: 'FAIL', message: 'verification failed' }, { status: 200 });
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
          signature: request.headers.get('wechatpay-signature'),
          verified: verification.valid,
        });
      }

    }

    return NextResponse.json({ code: 'SUCCESS', message: 'OK' }, { status: 200 });
  } catch (err) {
    console.error('[Notify/Wechat] Processing error:', { correlationId, error: err });
    return NextResponse.json({ code: 'FAIL', message: 'internal error' }, { status: 200 });
  }
}
