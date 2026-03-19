/**
 * Provider Save-Time Revalidation
 * Final server-side revalidation before persisting provider configs.
 * Requirements: 4.10, 4.12, 4.13, 8.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderType } from '@/lib/api/provider-configs';
import { decryptApiKey } from '@/lib/security/encryption';
import { validateProviderHostAsync } from '@/lib/security/provider-host-allowlist';
import { testProviderConnectivityWithTimeout } from '@/lib/security/provider-connectivity';

const DEFAULT_REVALIDATION_TIMEOUT_MS = 12_000;

export interface RevalidateProviderConfigParams {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  userId: string;
  provider: ProviderType;
  apiUrl: string;
  modelName: string;
  apiKey?: string;
  configId?: string;
}

export type RevalidateProviderConfigResult =
  | { success: true }
  | {
      success: false;
      status: number;
      code: string;
      message: string;
    };

export function getRevalidationTimeoutMs(): number {
  const raw = process.env.PROVIDER_REVALIDATION_TIMEOUT_MS;
  if (!raw) return DEFAULT_REVALIDATION_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REVALIDATION_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

/**
 * Load existing encrypted API key for edit-with-empty-key flow.
 */
async function loadExistingApiKey(
  userClient: SupabaseClient,
  userId: string,
  configId: string,
): Promise<string | null> {
  const { data, error } = await userClient
    .from('user_provider_configs')
    .select('api_key_encrypted')
    .eq('id', configId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  const encrypted = (data as Record<string, string>).api_key_encrypted;
  if (!encrypted) return null;

  try {
    return await decryptApiKey(encrypted);
  } catch {
    return null;
  }
}

/**
 * Final server-side provider revalidation.
 * Returns structured result without throwing.
 */
export async function revalidateProviderConfigBeforeSave(
  params: RevalidateProviderConfigParams,
): Promise<RevalidateProviderConfigResult> {
  const trimmedApiUrl = params.apiUrl.trim();
  const trimmedModelName = params.modelName.trim();

  const hostCheck = await validateProviderHostAsync(trimmedApiUrl, {
    serviceClient: params.serviceClient,
  });
  if (!hostCheck.valid) {
    if (hostCheck.code === 'ALLOWLIST_EMPTY') {
      return {
        success: false,
        status: 503,
        code: 'ALLOWLIST_UNAVAILABLE',
        message:
          'Provider host allowlist is unavailable or empty. Please contact administrator.',
      };
    }

    return {
      success: false,
      status: hostCheck.code === 'INVALID_URL' ? 400 : 403,
      code: hostCheck.code === 'INVALID_URL' ? 'INVALID_URL' : 'HOST_NOT_ALLOWED',
      message: hostCheck.reason,
    };
  }

  let resolvedApiKey = params.apiKey?.trim() || '';

  if (!resolvedApiKey) {
    if (!params.configId) {
      return {
        success: false,
        status: 400,
        code: 'CONFIG_ID_REQUIRED',
        message: 'configId is required when apiKey is omitted',
      };
    }

    const loadedKey = await loadExistingApiKey(
      params.userClient,
      params.userId,
      params.configId,
    );
    if (!loadedKey) {
      return {
        success: false,
        status: 404,
        code: 'CONFIG_NOT_FOUND',
        message: 'Could not load existing API key for revalidation',
      };
    }
    resolvedApiKey = loadedKey;
  }

  const timeoutMs = getRevalidationTimeoutMs();
  const connectivity = await testProviderConnectivityWithTimeout({
    provider: params.provider,
    apiUrl: trimmedApiUrl,
    apiKey: resolvedApiKey,
    modelName: trimmedModelName,
    timeoutMs,
  });

  if (!connectivity.success && connectivity.timedOut) {
    return {
      success: false,
      status: 504,
      code: 'REVALIDATION_TIMEOUT',
      message: connectivity.message || 'Final validation timed out',
    };
  }

  if (!connectivity.success) {
    return {
      success: false,
      status: 422,
      code: 'TEST_FAILED',
      message: connectivity.message || 'Provider connectivity test failed',
    };
  }

  return { success: true };
}
