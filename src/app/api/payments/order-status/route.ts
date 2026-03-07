/**
 * GET /api/payments/order-status?order_no=FX...
 * Returns the current status of a payment order. Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOrderByNo } from '@/lib/payments/order-service';
import { getServiceClient, getUserFromAuthHeader } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const orderNo = request.nextUrl.searchParams.get('order_no');
    if (!orderNo) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'order_no is required' } },
        { status: 400 }
      );
    }

    const sc = getServiceClient();
    const result = await getOrderByNo(sc, orderNo);

    if (!result) {
      return NextResponse.json(
        { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Ensure the order belongs to the authenticated user
    if (result.order.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      order_no: result.order.order_no,
      status: result.order.status,
      amount_fen: result.order.amount_fen,
      currency: result.order.currency,
      provider: result.order.provider,
      paid_at: result.order.paid_at,
      expires_at: result.order.expires_at,
      metadata: result.order.metadata,
      created_at: result.order.created_at,
    });
  } catch (err) {
    console.error('[API/payments/order-status] Error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
