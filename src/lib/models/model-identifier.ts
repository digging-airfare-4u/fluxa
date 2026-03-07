/**
 * Model Identifier Helpers
 * Utilities for distinguishing user-configured models (`user:{configId}`)
 * from system models (plain model_name).
 * Requirements: 5.1, 6.5
 */

import type { UserModelIdentifier } from '@/lib/api/provider-configs';

const USER_MODEL_PREFIX = 'user:';

/**
 * Check whether a model value is a user-configured model identifier.
 *
 * @example
 * isUserModelIdentifier('user:abc-123')  // true
 * isUserModelIdentifier('gemini-3-pro')  // false
 */
export function isUserModelIdentifier(value: string): value is UserModelIdentifier {
  return value.startsWith(USER_MODEL_PREFIX) && value.length > USER_MODEL_PREFIX.length;
}

/**
 * Build a `user:{configId}` identifier from a config ID.
 *
 * @example
 * toUserModelIdentifier('abc-123')  // 'user:abc-123'
 */
export function toUserModelIdentifier(configId: string): UserModelIdentifier {
  return `user:${configId}` as UserModelIdentifier;
}

/**
 * Extract the config ID from a user model identifier.
 * Returns `null` if the value is not a valid user model identifier.
 *
 * @example
 * parseUserModelConfigId('user:abc-123')  // 'abc-123'
 * parseUserModelConfigId('gemini-3-pro')  // null
 */
export function parseUserModelConfigId(value: string): string | null {
  if (!isUserModelIdentifier(value)) return null;
  return value.slice(USER_MODEL_PREFIX.length);
}
