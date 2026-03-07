/**
 * GET /api/payments/products
 * Returns enabled, self-serve payment products for the checkout UI.
 */

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';
import type { PaymentProduct } from '@/lib/payments/types';

export async function GET() {
  try {
    const sc = getServiceClient();

    const { data, error } = await sc
      .from('payment_products')
      .select('*')
      .eq('is_enabled', true)
      .eq('is_self_serve', true)
      .order('amount_fen', { ascending: true });

    if (error) {
      console.error('[API/payments/products] Query error:', error);
      return NextResponse.json(
        { error: { code: 'QUERY_FAILED', message: 'Failed to load products' } },
        { status: 500 }
      );
    }

    const products = (data ?? []) as PaymentProduct[];

    return NextResponse.json({ products });
  } catch (err) {
    console.error('[API/payments/products] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
