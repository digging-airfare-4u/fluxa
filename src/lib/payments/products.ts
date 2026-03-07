import { createServiceClient } from '@/lib/supabase/server';

export interface SellableMembershipProduct {
  code: string;
  name: string;
  level: 'free' | 'pro' | 'team';
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyAmountFen: number;
  yearlyAmountFen: number;
  period: string;
  isPopular: boolean;
  isSelfServe: boolean;
  description: string;
}

function parseDisplayConfig(value: unknown): {
  title?: string;
  description?: string;
  badge?: string;
  billing_cycle?: 'monthly' | 'yearly';
  yearly_code?: string;
} {
  if (!value || typeof value !== 'object') return {};
  return value as {
    title?: string;
    description?: string;
    badge?: string;
    billing_cycle?: 'monthly' | 'yearly';
    yearly_code?: string;
  };
}

export async function getSellableMembershipProducts(): Promise<SellableMembershipProduct[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('payment_products')
    .select('code, target_level, amount_fen, is_self_serve, is_enabled, display_config')
    .eq('kind', 'membership')
    .eq('is_enabled', true);

  if (error) {
    throw new Error(`Failed to fetch sellable products: ${error.message}`);
  }

  const records = (data || []).map((row) => {
    const cfg = parseDisplayConfig(row.display_config);
    const billingCycle = cfg.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    return {
      code: row.code as string,
      level: (row.target_level as 'free' | 'pro' | 'team') || 'free',
      amountFen: Number(row.amount_fen || 0),
      isSelfServe: row.is_self_serve === true,
      billingCycle,
      yearlyCode: cfg.yearly_code,
      title: cfg.title,
      description: cfg.description,
      isPopular: cfg.badge === 'recommended',
    };
  });

  const grouped = new Map<'free' | 'pro' | 'team', {
    monthly?: typeof records[number];
    yearly?: typeof records[number];
  }>();

  for (const item of records) {
    const current = grouped.get(item.level) || {};
    if (item.billingCycle === 'yearly') {
      current.yearly = item;
    } else {
      current.monthly = item;
    }
    grouped.set(item.level, current);
  }

  const output: SellableMembershipProduct[] = [];
  for (const [level, pair] of grouped.entries()) {
    const monthly = pair.monthly;
    const yearly = pair.yearly;

    if (!monthly && !yearly) continue;
    const base = monthly || yearly!;

    output.push({
      code: base.code,
      name: base.title || level.toUpperCase(),
      level,
      monthlyPrice: String(Math.round((monthly?.amountFen ?? base.amountFen) / 100)),
      yearlyPrice: String(Math.round((yearly?.amountFen ?? monthly?.amountFen ?? base.amountFen) / 100)),
      monthlyAmountFen: monthly?.amountFen ?? base.amountFen,
      yearlyAmountFen: yearly?.amountFen ?? monthly?.amountFen ?? base.amountFen,
      period: 'month',
      isPopular: base.isPopular,
      isSelfServe: base.isSelfServe,
      description: base.description || '',
    });
  }

  return output;
}
