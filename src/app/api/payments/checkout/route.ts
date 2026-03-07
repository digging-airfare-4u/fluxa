/**
 * POST /api/payments/checkout
 * Create a payment order and return channel-specific payment data.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getAdapter } from '@/lib/payments/adapter-factory';
import { createOrder, PaymentOrderError } from '@/lib/payments/order-service';
import { resolveScene } from '@/lib/payments/scene';
import type { PaymentChannel } from '@/lib/payments/types';
import { getServiceClient, getUserFromAuthHeader } from '@/lib/supabase/server';

interface CheckoutBody {
  product_code: string;
  channel: PaymentChannel;
  scene?: string;
  open_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CheckoutBody;

    if (!body.product_code || !body.channel) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'product_code and channel are required' } },
        { status: 400 }
      );
    }

    const ua = request.headers.get('user-agent');
    const scene = resolveScene(body.scene, ua);

    const sc = getServiceClient();
    const { data: paymentEnabledSetting, error: paymentEnabledError } = await sc
      .from('system_settings')
      .select('value')
      .eq('key', 'payment_enabled')
      .single();

    const paymentEnabled =
      !paymentEnabledError &&
      (paymentEnabledSetting?.value as { enabled?: boolean } | undefined)?.enabled === true;

    if (!paymentEnabled) {
      return NextResponse.json(
        { error: { code: 'PAYMENT_DISABLED', message: 'Payments are currently disabled' } },
        { status: 403 }
      );
    }

    const adapter = getAdapter(body.channel, body.open_id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const returnUrl = `${appUrl}/app/payment/result?order_no=`;

    const result = await createOrder(
      sc,
      {
        user_id: user.id,
        product_code: body.product_code,
        channel: body.channel,
        scene,
        scene_metadata: {
          user_agent: ua,
          scene,
          ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
        },
      },
      adapter,
      `${returnUrl}${encodeURIComponent('__ORDER_NO__')}`
    );

    // Replace placeholder in return URL with actual order_no
    const channelData = { ...result.channel_data };
    if (typeof channelData.url === 'string') {
      channelData.url = channelData.url.replace('__ORDER_NO__', result.order.order_no);
    }

    return NextResponse.json({
      order_no: result.order.order_no,
      order_id: result.order.id,
      status: result.order.status,
      expires_at: result.order.expires_at,
      channel_data: channelData,
    });
  } catch (err) {
    if (err instanceof PaymentOrderError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }

    console.error('[API/payments/checkout] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create checkout' } },
      { status: 500 }
    );
  }
}
