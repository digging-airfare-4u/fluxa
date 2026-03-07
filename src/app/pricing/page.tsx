'use client';

/**
 * Pricing Page (Public)
 * Displays membership plans fetched from Supabase and payment products from the API.
 */

import { useEffect, useState } from 'react';
import { Pricing, PointsRules, type PricingPlan } from '@/components/pricing';
import { SiteHeader } from '@/components/layout';
import { getMembershipConfigs, transformToPricingPlans } from '@/lib/supabase/queries/membership';
import { isPaymentEnabled } from '@/lib/supabase/queries/settings';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentProduct } from '@/lib/payments/types';

async function fetchPaymentProducts(): Promise<PaymentProduct[]> {
  try {
    const res = await fetch('/api/payments/products');
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [configs, enabled, products] = await Promise.all([
          getMembershipConfigs(),
          isPaymentEnabled(),
          fetchPaymentProducts(),
        ]);
        const pricingPlans = transformToPricingPlans(configs, products);
        setPlans(pricingPlans);
        setPaymentEnabled(enabled);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container py-12">
          <div className="text-center space-y-2 mb-8">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-72 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container py-12 text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Pricing plans={plans} paymentEnabled={paymentEnabled} />
      <PointsRules />
    </div>
  );
}
