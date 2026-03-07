import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/observability/logger';
import { getOrderByNo } from '@/lib/payments';
import { getServiceClient, getUserFromAuthHeader } from '@/lib/supabase/server';

const logger = createLogger('API:payments-order-status');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNo: string }> },
) {
  try {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    const user = await getUserFromAuthHeader(request.headers.get('authorization'));
    const { orderNo } = await context.params;

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!orderNo) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'orderNo is required' } },
        { status: 400 },
      );
    }

    const sc = getServiceClient();
    const data = await getOrderByNo(sc, orderNo);

    if (!data || data.order.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } },
        { status: 404 },
      );
    }

    logger.info('order_status_fetched', {
      request_id: requestId,
      user_id: user.id,
      order_no: orderNo,
      status: data.order.status,
    });

    return NextResponse.json({ data });
  } catch (err) {
    logger.error('order_status_internal_error', { error: err instanceof Error ? err.message : String(err) });

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get order status' } },
      { status: 500 },
    );
  }
}
