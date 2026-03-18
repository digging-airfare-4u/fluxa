/**
 * User Provider Service
 * Fetches and decrypts shared/user provider configurations from the database.
 * Requirements: 5.1, 5.2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

// ============================================================================
// Types
// ============================================================================

export interface UserProviderRecord {
  id: string;
  user_id: string;
  provider: string;
  api_key: string; // decrypted — only available inside edge runtime
  api_url: string;
  model_name: string;
  display_name: string;
  model_type: 'image' | 'chat';
  is_enabled: boolean;
}

// ============================================================================
// AES-256-GCM Decryption (mirrors src/lib/security/encryption.ts)
// ============================================================================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV
const TAG_LENGTH = 128; // 128-bit auth tag
const PBKDF2_SALT = 'fluxa-provider-config';
const PBKDF2_ITERATIONS = 100_000;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['decrypt']
  );
}

async function decryptApiKey(encrypted: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

// ============================================================================
// UserProviderService
// ============================================================================

export class UserProviderService {
  constructor(
    private supabase: SupabaseClient,
    private encryptionSecret: string
  ) {}

  /**
   * Fetch a provider config by ID.
   * Returns null if not found, disabled, mismatched, or not visible to the requester.
   * Visibility rules:
   *   1. the requester owns the config, or
   *   2. the config owner is marked as super admin.
   * The returned record contains the decrypted API key.
   * Requirements: 5.1, 5.2
   */
  async getConfigById(
    userId: string,
    configId: string,
    expectedModelType?: UserProviderRecord['model_type'],
  ): Promise<UserProviderRecord | null> {
    const { data, error } = await this.supabase
      .from('user_provider_configs')
      .select('id, user_id, provider, api_key_encrypted, api_url, model_name, display_name, model_type, is_enabled')
      .eq('id', configId)
      .single();

    if (error || !data) {
      console.warn(
        `[UserProviderService] Config not found: configId=${configId}, userId=${userId}`,
        error?.message
      );
      return null;
    }

    if (!data.is_enabled) {
      console.warn(
        `[UserProviderService] Config disabled: configId=${configId}, userId=${userId}`
      );
      return null;
    }

    const modelType = data.model_type === 'chat' ? 'chat' : 'image';
    if (expectedModelType && modelType !== expectedModelType) {
      console.warn(
        `[UserProviderService] Config type mismatch: configId=${configId}, userId=${userId}, expected=${expectedModelType}, actual=${modelType}`
      );
      return null;
    }

    if (data.user_id !== userId) {
      const { data: ownerProfile, error: ownerError } = await this.supabase
        .from('user_profiles')
        .select('is_super_admin')
        .eq('id', data.user_id)
        .maybeSingle();

      if (ownerError || ownerProfile?.is_super_admin !== true) {
        console.warn(
          `[UserProviderService] Config not visible to requester: configId=${configId}, userId=${userId}, ownerId=${data.user_id}`,
          ownerError?.message
        );
        return null;
      }
    }

    // Decrypt the API key
    let apiKey: string;
    try {
      apiKey = await decryptApiKey(data.api_key_encrypted, this.encryptionSecret);
    } catch (err) {
      console.error(
        `[UserProviderService] Decryption failed: configId=${configId}, userId=${userId}`,
        err instanceof Error ? err.message : err
      );
      return null;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      provider: data.provider,
      api_key: apiKey,
      api_url: data.api_url,
      model_name: data.model_name,
      display_name: data.display_name,
      model_type: modelType,
      is_enabled: data.is_enabled,
    };
  }
}
