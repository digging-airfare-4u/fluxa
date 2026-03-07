/**
 * Payment Channel Resolution
 * Loads channel config from system_settings and filters by scene + feature flags.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AvailableChannelsResult,
  CheckoutScene,
  PaymentChannel,
  PaymentChannelsConfig,
} from './types';

const DEFAULT_CHANNELS_CONFIG: PaymentChannelsConfig = {
  alipay_page: { enabled: false, label: '支付宝', label_en: 'Alipay', scenes: ['desktop', 'mobile_browser'] },
  wechat_native: { enabled: false, label: '微信支付', label_en: 'WeChat Pay', scenes: ['desktop'] },
  wechat_jsapi: { enabled: false, label: '微信支付(公众号)', label_en: 'WeChat JSAPI', scenes: ['wechat_browser'] },
  unionpay: { enabled: false, label: '银联支付', label_en: 'UnionPay', scenes: ['desktop', 'mobile_browser'] },
};

const VALID_SCENES: CheckoutScene[] = ['desktop', 'mobile_browser', 'wechat_browser'];
const CHANNEL_KEYS: PaymentChannel[] = ['alipay_page', 'wechat_native', 'wechat_jsapi', 'unionpay'];

function cloneDefaultConfig(): PaymentChannelsConfig {
  return {
    alipay_page: { ...DEFAULT_CHANNELS_CONFIG.alipay_page, scenes: [...DEFAULT_CHANNELS_CONFIG.alipay_page.scenes] },
    wechat_native: {
      ...DEFAULT_CHANNELS_CONFIG.wechat_native,
      scenes: [...DEFAULT_CHANNELS_CONFIG.wechat_native.scenes],
    },
    wechat_jsapi: { ...DEFAULT_CHANNELS_CONFIG.wechat_jsapi, scenes: [...DEFAULT_CHANNELS_CONFIG.wechat_jsapi.scenes] },
    unionpay: { ...DEFAULT_CHANNELS_CONFIG.unionpay, scenes: [...DEFAULT_CHANNELS_CONFIG.unionpay.scenes] },
  };
}

function normalizeChannelsConfig(raw: unknown): PaymentChannelsConfig {
  const normalized = cloneDefaultConfig();

  if (!raw || typeof raw !== 'object') return normalized;

  const value = raw as Record<string, unknown>;

  // Preferred shape: channel-level keys
  let hasChannelLevelShape = false;
  for (const key of CHANNEL_KEYS) {
    const cfg = value[key];
    if (!cfg || typeof cfg !== 'object') continue;

    const current = cfg as Record<string, unknown>;
    const shouldTreatAsChannelShape =
      key !== 'unionpay' ||
      Array.isArray(current.scenes) ||
      typeof current.label === 'string' ||
      typeof current.label_en === 'string';

    if (!shouldTreatAsChannelShape) {
      continue;
    }

    hasChannelLevelShape = true;
    const scenes = Array.isArray(current.scenes)
      ? current.scenes.filter((scene): scene is CheckoutScene => VALID_SCENES.includes(scene as CheckoutScene))
      : [];

    normalized[key] = {
      enabled: current.enabled === true,
      label: typeof current.label === 'string' && current.label.trim().length > 0
        ? current.label
        : DEFAULT_CHANNELS_CONFIG[key].label,
      label_en: typeof current.label_en === 'string' && current.label_en.trim().length > 0
        ? current.label_en
        : DEFAULT_CHANNELS_CONFIG[key].label_en,
      scenes: scenes.length > 0 ? scenes : [...DEFAULT_CHANNELS_CONFIG[key].scenes],
    };
  }

  if (hasChannelLevelShape) return normalized;

  // Legacy shape: provider-level keys
  const legacyAlipay = value.alipay as { enabled?: unknown } | undefined;
  const legacyWechat = value.wechat as { enabled?: unknown } | undefined;
  const legacyUnionPay = value.unionpay as { enabled?: unknown } | undefined;

  if (legacyAlipay?.enabled === true) {
    normalized.alipay_page.enabled = true;
  }

  if (legacyWechat?.enabled === true) {
    normalized.wechat_native.enabled = true;
    normalized.wechat_jsapi.enabled = true;
  }

  if (legacyUnionPay?.enabled === true) {
    normalized.unionpay.enabled = true;
  }

  return normalized;
}

/**
 * Load payment_channels config from system_settings via service client.
 */
export async function loadChannelsConfig(
  serviceClient: SupabaseClient
): Promise<PaymentChannelsConfig> {
  const { data, error } = await serviceClient
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_channels')
    .single();

  if (error || !data?.value) {
    console.error('[Payments] Failed to load payment_channels config:', error);
    return cloneDefaultConfig();
  }

  return normalizeChannelsConfig(data.value);
}

/**
 * Return channels available for a given scene, respecting enabled flags.
 */
export async function getAvailableChannels(
  serviceClient: SupabaseClient,
  scene: CheckoutScene
): Promise<AvailableChannelsResult> {
  const config = await loadChannelsConfig(serviceClient);

  const channels = (Object.entries(config) as [PaymentChannel, typeof config[PaymentChannel]][])
    .filter(([, cfg]) => cfg.enabled && Array.isArray(cfg.scenes) && cfg.scenes.includes(scene))
    .map(([ch, cfg]) => ({
      channel: ch,
      label: cfg.label,
      label_en: cfg.label_en,
    }));

  return { scene, channels };
}

/**
 * Check if a specific channel is available for a scene.
 */
export async function isChannelAvailable(
  serviceClient: SupabaseClient,
  channel: PaymentChannel,
  scene: CheckoutScene
): Promise<boolean> {
  const config = await loadChannelsConfig(serviceClient);
  const ch = config[channel];
  return ch?.enabled === true && Array.isArray(ch.scenes) && ch.scenes.includes(scene);
}
