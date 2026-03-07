/**
 * Feature Flags for Model Config Settings
 * Reads from system_settings with env-var fallback. Default: OFF.
 * Requirements: 8.4
 *
 * Rollback procedure:
 *   1. Set system_settings key `model_config_enabled` to { "enabled": false }
 *      OR set env var MODEL_CONFIG_ENABLED=false
 *   2. The UI will hide the settings panel; Edge will reject user: model routes.
 *   3. Existing user_provider_configs rows are preserved (no data loss).
 *   4. Re-enable by setting the flag back to true.
 */

import { supabase } from '@/lib/supabase/client';

// ============================================================================
// Cache
// ============================================================================

let cachedValue: boolean | null = null;
let cacheTs = 0;
let cachedDiscoveryValue: { enabled: boolean; allowUserIds: string[] } | null = null;
let cachedDiscoveryTs = 0;
const CACHE_TTL_MS = 60_000; // 60s — same cadence as allowlist cache

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether the Model Config Settings feature is enabled.
 * Resolution order:
 *   1. system_settings.model_config_enabled  (DB, cached 60s)
 *   2. env NEXT_PUBLIC_MODEL_CONFIG_ENABLED  (build-time fallback)
 *   3. Default: false (feature off)
 */
export async function isModelConfigEnabled(): Promise<boolean> {
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
    // DB unreachable — fall through to env
  }

  // Env fallback
  const envVal = process.env.NEXT_PUBLIC_MODEL_CONFIG_ENABLED;
  cachedValue = envVal === 'true';
  cacheTs = now;
  return cachedValue;
}

export interface InspirationDiscoveryFlag {
  enabled: boolean;
  allowUserIds: string[];
}

/**
 * Check inspiration discovery rollout flag.
 * Resolution order:
 *   1. system_settings.inspiration_discovery_enabled
 *   2. env NEXT_PUBLIC_INSPIRATION_DISCOVERY_ENABLED
 *   3. default false
 */
export async function getInspirationDiscoveryFlag(): Promise<InspirationDiscoveryFlag> {
  const now = Date.now();
  if (cachedDiscoveryValue !== null && now - cachedDiscoveryTs < CACHE_TTL_MS) {
    return cachedDiscoveryValue;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'inspiration_discovery_enabled')
      .single();

    if (!error && data) {
      const value = data.value as { enabled?: boolean; allow_user_ids?: unknown };
      cachedDiscoveryValue = {
        enabled: value?.enabled === true,
        allowUserIds: Array.isArray(value?.allow_user_ids)
          ? value.allow_user_ids.filter((id): id is string => typeof id === 'string')
          : [],
      };
      cachedDiscoveryTs = now;
      return cachedDiscoveryValue;
    }
  } catch {
    // DB unreachable — fall through to env
  }

  const envVal = process.env.NEXT_PUBLIC_INSPIRATION_DISCOVERY_ENABLED;
  cachedDiscoveryValue = {
    enabled: envVal === 'true',
    allowUserIds: [],
  };
  cachedDiscoveryTs = now;
  return cachedDiscoveryValue;
}

export async function isInspirationDiscoveryEnabledForUser(userId?: string | null): Promise<boolean> {
  const flag = await getInspirationDiscoveryFlag();
  if (!flag.enabled) return false;
  if (!Array.isArray(flag.allowUserIds) || flag.allowUserIds.length === 0) return true;
  return !!userId && flag.allowUserIds.includes(userId);
}

/** Reset cache (for testing). */
export function resetFeatureFlagCache(): void {
  cachedValue = null;
  cacheTs = 0;
  cachedDiscoveryValue = null;
  cachedDiscoveryTs = 0;
}
