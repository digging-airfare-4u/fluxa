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

type PricingTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface TransformToPricingPlansOptions {
  locale?: string;
  formatNumber?: (value: number) => string;
  t?: PricingTranslate;
}

const DEFAULT_PRICING_MESSAGES: Record<'zh-CN' | 'en-US', Record<string, string>> = {
  'zh-CN': {
    'plans.free.name': '免费版',
    'plans.free.description': '适合个人用户体验',
    'plans.free.button': '开始使用',
    'plans.pro.name': '专业版',
    'plans.pro.description': '适合专业设计师和创作者',
    'plans.pro.button': '升级专业版',
    'plans.team.name': '团队版',
    'plans.team.description': '适合团队协作和企业用户',
    'plans.team.button': '联系我们',
    'plan_actions.contact_sales': '联系我们',
    'plan_actions.select': '选择',
    'plan_features.initial_points': '{count} 初始点数',
    'plan_features.no_watermark_export': '无水印导出',
    'plan_features.priority_queue': '优先生成队列',
    'plan_features.basic_ai_models': '基础 AI 模型',
    'plan_features.community_support': '社区支持',
    'plan_features.all_ai_models': '所有 AI 模型',
    'plan_features.hd_export': '高清导出',
    'plan_features.priority_support': '优先客服支持',
    'plan_features.team_collaboration': '团队协作',
    'plan_features.dedicated_support': '专属客服',
    'plan_features.api_access': 'API 访问',
  },
  'en-US': {
    'plans.free.name': 'Free',
    'plans.free.description': 'Best for exploring the product on your own',
    'plans.free.button': 'Get Started',
    'plans.pro.name': 'Pro',
    'plans.pro.description': 'Best for professional designers and creators',
    'plans.pro.button': 'Upgrade to Pro',
    'plans.team.name': 'Team',
    'plans.team.description': 'Best for team collaboration and businesses',
    'plans.team.button': 'Contact Sales',
    'plan_actions.contact_sales': 'Contact Sales',
    'plan_actions.select': 'Select',
    'plan_features.initial_points': '{count} starter points',
    'plan_features.no_watermark_export': 'Watermark-free export',
    'plan_features.priority_queue': 'Priority generation queue',
    'plan_features.basic_ai_models': 'Basic AI models',
    'plan_features.community_support': 'Community support',
    'plan_features.all_ai_models': 'All AI models',
    'plan_features.hd_export': 'HD export',
    'plan_features.priority_support': 'Priority support',
    'plan_features.team_collaboration': 'Team collaboration',
    'plan_features.dedicated_support': 'Dedicated support',
    'plan_features.api_access': 'API access',
  },
};

function createFallbackPricingTranslator(locale = 'zh-CN'): PricingTranslate {
  const dictionary = locale.startsWith('en')
    ? DEFAULT_PRICING_MESSAGES['en-US']
    : DEFAULT_PRICING_MESSAGES['zh-CN'];

  return (key, values) => {
    let message = dictionary[key] ?? key;
    if (!values) return message;

    for (const [placeholder, value] of Object.entries(values)) {
      message = message.replaceAll(`{${placeholder}}`, String(value));
    }

    return message;
  };
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
  products: PaymentProduct[] = [],
  options: TransformToPricingPlansOptions = {},
): PricingPlan[] {
  const locale = options.locale ?? 'zh-CN';
  const translate = options.t ?? createFallbackPricingTranslator(locale);
  const formatNumber = options.formatNumber ?? ((value: number) => value.toLocaleString(locale));
  const productByCode = new Map(products.map((p) => [p.code, p]));

  const planDetails: Record<string, Partial<PricingPlan> & { monthlyCode?: string; yearlyCode?: string }> = {
    free: {
      price: '0',
      yearlyPrice: '0',
      period: 'month',
      name: translate('plans.free.name'),
      buttonText: translate('plans.free.button'),
      href: '/auth',
      isPopular: false,
      isSelfServe: true,
      description: translate('plans.free.description'),
    },
    pro: {
      price: '49',
      yearlyPrice: '399',
      period: 'month',
      name: translate('plans.pro.name'),
      buttonText: translate('plans.pro.button'),
      href: '#checkout',
      isPopular: true,
      isSelfServe: true,
      description: translate('plans.pro.description'),
      monthlyCode: 'pro-monthly',
      yearlyCode: 'pro-yearly',
    },
    team: {
      price: '199',
      yearlyPrice: '1999',
      period: 'month',
      name: translate('plans.team.name'),
      buttonText: translate('plans.team.button'),
      href: '#contact-sales',
      isPopular: false,
      isSelfServe: false,
      description: translate('plans.team.description'),
      monthlyCode: 'team-monthly',
      yearlyCode: 'team-yearly',
    },
  };

  return configs.map((config) => {
    const details = planDetails[config.level] || {};
    const features = generateFeatures(config, { formatNumber, t: translate });

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
      name: details.name || config.display_name,
      level: config.level,
      price: monthlyPrice,
      yearlyPrice,
      period: details.period || 'month',
      features,
      description: details.description || '',
      buttonText: isSelfServe
        ? (details.buttonText || translate('plan_actions.select'))
        : translate('plan_actions.contact_sales'),
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
function generateFeatures(
  config: MembershipConfig,
  {
    formatNumber,
    t,
  }: {
    formatNumber: (value: number) => string;
    t: PricingTranslate;
  },
): string[] {
  const features: string[] = [];

  features.push(t('plan_features.initial_points', { count: formatNumber(config.initial_points) }));

  if (config.perks.no_watermark) {
    features.push(t('plan_features.no_watermark_export'));
  }
  if (config.perks.priority_queue) {
    features.push(t('plan_features.priority_queue'));
  }

  if (config.level === 'free') {
    features.push(t('plan_features.basic_ai_models'));
    features.push(t('plan_features.community_support'));
  } else if (config.level === 'pro') {
    features.push(t('plan_features.all_ai_models'));
    features.push(t('plan_features.hd_export'));
    features.push(t('plan_features.priority_support'));
  } else if (config.level === 'team') {
    features.push(t('plan_features.all_ai_models'));
    features.push(t('plan_features.hd_export'));
    features.push(t('plan_features.team_collaboration'));
    features.push(t('plan_features.dedicated_support'));
    features.push(t('plan_features.api_access'));
  }

  return features;
}
