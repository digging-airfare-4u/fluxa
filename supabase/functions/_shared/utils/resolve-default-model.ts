/**
 * Shared helper to resolve a default model name from system_settings.
 * Fallback chain: system_settings DB lookup → provided fallback constant.
 * No environment variables participate in the resolution.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

/**
 * Resolve a default model name from the `system_settings` table.
 *
 * @param serviceClient - Supabase service-role client (bypasses RLS)
 * @param settingsKey - The `system_settings.key` to look up (e.g. 'default_chat_model')
 * @param fallback - Hardcoded constant to use when the DB key is missing.
 *                   Pass `null` to allow callers to chain multiple lookups
 *                   (e.g. agent brain → default chat → constant).
 * @returns The resolved model name, or `null` if fallback is `null` and DB key is missing.
 */
export async function resolveDefaultModel(
  serviceClient: SupabaseClient,
  settingsKey: string,
  fallback: string | null,
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from('system_settings')
    .select('value')
    .eq('key', settingsKey)
    .maybeSingle();

  if (error) {
    console.warn(
      `[resolve-default-model] Failed to load ${settingsKey}, using fallback: ${error.message}`,
    );
    return fallback;
  }

  const configuredModel = (data?.value as { model?: unknown } | null)?.model;

  if (typeof configuredModel === 'string' && configuredModel.trim()) {
    return configuredModel.trim();
  }

  return fallback;
}
