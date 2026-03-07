/**
 * Membership configuration queries
 * Fetches pricing and membership data from Supabase.
 * When payment products are available, prices come from the backend instead of hardcoded values.
 */

import { supabase } from '@/lib/supabase/client';
import type { PaymentProduct } from '@/lib/payments/types';

export interface MembershipConfig {
  level: 'free' | 'pro' | 'team';
  display_name: string;
  initial_points: number;
  perks: {
    no_watermark?: boolean;
    priority_queue?: boolean;
    [key: string]: boolean | undefined;
  };
  created_at: string;
  updated_at: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
  level: 'free' | 'pro' | 'team';
  productCode?: string;
  yearlyProductCode?: string;
  isSelfServe: boolean;
}

/**
 * Fetch all membership configurations from database
 */
export async function getMembershipConfigs(): Promise<MembershipConfig[]> {
  const { data, error } = await supabase
    .from('membership_configs')
    .select('*')
    .order('initial_points', { ascending: true });

  if (error) {
    console.error('Failed to fetch membership configs:', error);
    throw new Error(`Failed to fetch membership configs: ${error.message}`);
  }

  return data || [];
}

/**
 * Transform membership configs to pricing plans format.
 * When products are provided, prices come from the backend; otherwise falls back to hardcoded values.
 */
export function transformToPricingPlans(
  configs: MembershipConfig[],
  products: PaymentProduct[] = []
): PricingPlan[] {
  const productByCode = new Map(products.map((p) => [p.code, p]));

  const planDetails: Record<string, Partial<PricingPlan> & { monthlyCode?: string; yearlyCode?: string }> = {
    free: {
      price: '0',
      yearlyPrice: '0',
      period: 'month',
      buttonText: '开始使用',
      href: '/auth',
      isPopular: false,
      isSelfServe: true,
      description: '适合个人用户体验',
    },
    pro: {
      price: '49',
      yearlyPrice: '399',
      period: 'month',
      buttonText: '升级专业版',
      href: '#checkout',
      isPopular: true,
      isSelfServe: true,
      description: '适合专业设计师和创作者',
      monthlyCode: 'pro-monthly',
      yearlyCode: 'pro-yearly',
    },
    team: {
      price: '199',
      yearlyPrice: '1999',
      period: 'month',
      buttonText: '联系我们',
      href: '#contact-sales',
      isPopular: false,
      isSelfServe: false,
      description: '适合团队协作和企业用户',
      monthlyCode: 'team-monthly',
      yearlyCode: 'team-yearly',
    },
  };

  return configs.map((config) => {
    const details = planDetails[config.level] || {};
    const features = generateFeatures(config);

    // Override prices from backend products when available
    const monthlyProduct = details.monthlyCode ? productByCode.get(details.monthlyCode) : undefined;
    const yearlyProduct = details.yearlyCode ? productByCode.get(details.yearlyCode) : undefined;

    const monthlyPrice = monthlyProduct
      ? (monthlyProduct.amount_fen / 100).toString()
      : details.price || '0';
    const yearlyPrice = yearlyProduct
      ? (yearlyProduct.amount_fen / 100 / 12).toFixed(0)
      : details.yearlyPrice || '0';

    const isSelfServe = monthlyProduct?.is_self_serve ?? details.isSelfServe ?? true;

    return {
      name: config.display_name,
      level: config.level,
      price: monthlyPrice,
      yearlyPrice,
      period: details.period || 'month',
      features,
      description: details.description || '',
      buttonText: isSelfServe ? (details.buttonText || '选择') : '联系我们',
      href: isSelfServe ? '#checkout' : '#contact-sales',
      isPopular: details.isPopular || false,
      productCode: details.monthlyCode,
      yearlyProductCode: details.yearlyCode,
      isSelfServe,
    };
  });
}

/**
 * Generate feature list from membership config
 */
function generateFeatures(config: MembershipConfig): string[] {
  const features: string[] = [];

  // Points feature
  features.push(`${config.initial_points.toLocaleString()} 初始点数`);

  // Perks
  if (config.perks.no_watermark) {
    features.push('无水印导出');
  }
  if (config.perks.priority_queue) {
    features.push('优先生成队列');
  }

  // Level-specific features
  if (config.level === 'free') {
    features.push('基础 AI 模型');
    features.push('社区支持');
  } else if (config.level === 'pro') {
    features.push('所有 AI 模型');
    features.push('高清导出');
    features.push('优先客服支持');
  } else if (config.level === 'team') {
    features.push('所有 AI 模型');
    features.push('高清导出');
    features.push('团队协作');
    features.push('专属客服');
    features.push('API 访问');
  }

  return features;
}
