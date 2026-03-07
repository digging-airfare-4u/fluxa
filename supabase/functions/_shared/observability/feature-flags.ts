/**
 * Feature Flags for Edge Functions (Deno runtime)
 * Reads from system_settings with env-var fallback. Default: OFF.
 * Requirements: 8.4
 *
 * Rollback procedure:
 *   1. Set system_settings key `model_config_enabled` to { "enabled": false }
 *      OR set env var MODEL_CONFIG_ENABLED=false
 *   2. Edge will reject user: model routes with a clear error.
 *   3. Existing user_provider_configs rows are preserved (no data loss).
 *   4. Re-enable by setting the flag back to true.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

let cachedValue: boolean | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Check whether the Model Config Settings feature is enabled.
 * Resolution: system_settings → env MODEL_CONFIG_ENABLED → false
 */
export async function isModelConfigEnabled(supabase: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (cachedValue !== null && now - cacheTs < CACHE_TTL_MS) {
    return cachedValue;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'model_config_enabled')
      .single();

    if (!error && data) {
      const val = (data.value as { enabled?: boolean })?.enabled;
      cachedValue = val === true;
      cacheTs = now;
      return cachedValue;
    }
  } catch {
    // DB unreachable — fall through
  }

  const envVal = Deno.env.get('MODEL_CONFIG_ENABLED');
  cachedValue = envVal === 'true';
  cacheTs = now;
  return cachedValue;
}

export function resetFeatureFlagCache(): void {
  cachedValue = null;
  cacheTs = 0;
}
