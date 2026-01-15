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
    // Default to enabled if query fails
    return true;
  }

  return (data?.value as { enabled?: boolean })?.enabled ?? true;
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
