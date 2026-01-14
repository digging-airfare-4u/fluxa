/**
 * Membership configuration queries
 * Fetches pricing and membership data from Supabase
 */

import { supabase } from '@/lib/supabase/client';

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
 * Transform membership configs to pricing plans format
 */
export function transformToPricingPlans(configs: MembershipConfig[]): PricingPlan[] {
  const planDetails: Record<string, Partial<PricingPlan>> = {
    free: {
      price: '0',
      yearlyPrice: '0',
      period: 'month',
      buttonText: '开始使用',
      href: '/auth',
      isPopular: false,
      description: '适合个人用户体验',
    },
    pro: {
      price: '29',
      yearlyPrice: '23',
      period: 'month',
      buttonText: '升级专业版',
      href: '/app/pricing?plan=pro',
      isPopular: true,
      description: '适合专业设计师和创作者',
    },
    team: {
      price: '99',
      yearlyPrice: '79',
      period: 'month',
      buttonText: '联系我们',
      href: '/app/pricing?plan=team',
      isPopular: false,
      description: '适合团队协作和企业用户',
    },
  };

  return configs.map((config) => {
    const details = planDetails[config.level] || {};
    const features = generateFeatures(config);

    return {
      name: config.display_name,
      level: config.level,
      price: details.price || '0',
      yearlyPrice: details.yearlyPrice || '0',
      period: details.period || 'month',
      features,
      description: details.description || '',
      buttonText: details.buttonText || '选择',
      href: details.href || '#',
      isPopular: details.isPopular || false,
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
