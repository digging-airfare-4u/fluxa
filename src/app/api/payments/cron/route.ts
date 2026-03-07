/**
 * POST /api/payments/cron
 * Runs periodic payment maintenance tasks: expire orders, query pending orders.
 * Protected by a shared secret (CRON_SECRET env var).
 */

import { NextRequest, NextResponse } from 'next/server';

import { expirePendingOrders } from '@/lib/payments/jobs/expire-orders';
import { queryPendingOrders } from '@/lib/payments/jobs/query-pending';
import { getServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 }
    );
  }

  const sc = getServiceClient();

  const [expireResult, queryResult] = await Promise.all([
    expirePendingOrders(sc),
    queryPendingOrders(sc),
  ]);

  console.log('[Cron/Payments] Results:', { expire: expireResult, query: queryResult });

  return NextResponse.json({
    expired: expireResult.expired,
    queried: queryResult.queried,
    settled: queryResult.settled,
    timestamp: new Date().toISOString(),
  });
}
