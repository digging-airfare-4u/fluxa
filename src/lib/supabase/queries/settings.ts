/**
 * System settings queries
 * Fetches global configuration from Supabase
 */

import { supabase } from '@/lib/supabase/client';

export interface SystemSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check if payment/recharge is enabled
 */
export async function isPaymentEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_enabled')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch payment_enabled:', error);
    // Fail closed for payment safety
    return false;
  }

  return (data?.value as { enabled?: boolean })?.enabled === true;
}

export interface PaymentChannelsSetting {
  alipay: { enabled: boolean; mode: 'sandbox' | 'production' };
  wechat: { enabled: boolean; mode: 'sandbox' | 'production' };
  unionpay: { enabled: boolean };
}

export async function getPaymentChannelsSetting(): Promise<PaymentChannelsSetting> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_channels')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch payment_channels:', error);
    return {
      alipay: { enabled: false, mode: 'sandbox' },
      wechat: { enabled: false, mode: 'sandbox' },
      unionpay: { enabled: false },
    };
  }

  const value = (data?.value as Record<string, unknown>) || {};
  const alipay = (value.alipay as Record<string, unknown>) || {};
  const wechat = (value.wechat as Record<string, unknown>) || {};
  const unionpay = (value.unionpay as Record<string, unknown>) || {};

  const parseMode = (mode: unknown): 'sandbox' | 'production' => (mode === 'production' ? 'production' : 'sandbox');

  return {
    alipay: { enabled: alipay.enabled === true, mode: parseMode(alipay.mode) },
    wechat: { enabled: wechat.enabled === true, mode: parseMode(wechat.mode) },
    unionpay: { enabled: unionpay.enabled === true },
  };
}

export async function getPaymentEnv(): Promise<'sandbox' | 'production'> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_env')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch payment_env:', error);
    return 'sandbox';
  }

  const env = (data?.value as { env?: unknown })?.env;
  return env === 'production' ? 'production' : 'sandbox';
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<SystemSetting | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', key)
    .single();

  if (error) {
    console.error(`[Settings] Failed to fetch setting ${key}:`, error);
    return null;
  }

  return data;
}

export async function getAgentDefaultBrainModel(): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'agent_default_brain_model')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch agent_default_brain_model:', error);
    return null;
  }

  const model = (data?.value as { model?: unknown } | null)?.model;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}

/**
 * Get the Gemini API host URL
 * Returns the configured host or the default Google API endpoint
 */
export async function getGeminiApiHost(): Promise<string> {
  const DEFAULT_HOST = 'https://generativelanguage.googleapis.com';

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gemini_api_host')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch gemini_api_host:', error);
    return DEFAULT_HOST;
  }

  return (data?.value as { host?: string })?.host ?? DEFAULT_HOST;
}

export interface InspirationDiscoverySetting {
  enabled: boolean;
  allow_user_ids: string[];
}

export async function getInspirationDiscoverySetting(): Promise<InspirationDiscoverySetting> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'inspiration_discovery_enabled')
    .single();

  if (error) {
    console.error('[Settings] Failed to fetch inspiration_discovery_enabled:', error);
    return { enabled: false, allow_user_ids: [] };
  }

  const value = (data?.value as { enabled?: boolean; allow_user_ids?: unknown }) || {};
  return {
    enabled: value.enabled === true,
    allow_user_ids: Array.isArray(value.allow_user_ids)
      ? value.allow_user_ids.filter((id): id is string => typeof id === 'string')
      : [],
  };
}
