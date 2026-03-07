/**
 * API Key Encryption Utilities
 * Provides AES-256-GCM encryption/decryption for user provider API keys.
 * Requirements: 2.2 - Encrypt API key before persistence
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const TAG_LENGTH = 128; // 128-bit auth tag

/**
 * Derive a CryptoKey from the encryption secret.
 */
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
      salt: encoder.encode('fluxa-provider-config'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an API key. Returns a base64-encoded string containing IV + ciphertext.
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const secret = getEncryptionSecret();
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an API key from the base64-encoded IV + ciphertext.
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  const secret = getEncryptionSecret();
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

/**
 * Extract last 4 characters of an API key for display masking.
 */
export function getApiKeyLast4(apiKey: string): string {
  if (apiKey.length < 4) return apiKey;
  return apiKey.slice(-4);
}

function getEncryptionSecret(): string {
  const secret = process.env.PROVIDER_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('PROVIDER_ENCRYPTION_SECRET environment variable is not set');
  }
  return secret;
}
