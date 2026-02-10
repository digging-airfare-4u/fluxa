/**
 * Provider Config Validator
 * Validates ProviderConfig objects for required fields and correct types.
 * Requirements: 3.5, 3.6, 4.3
 */

import type { ProviderConfig } from './chat-types.ts';

export type ValidationSuccess = { valid: true; config: ProviderConfig };
export type ValidationFailure = { valid: false; errors: string[] };
export type ConfigValidationResult = ValidationSuccess | ValidationFailure;

const REQUIRED_FIELDS = ['name', 'apiUrl', 'authType', 'apiKeyEnvVar'] as const;
const VALID_AUTH_TYPES = ['bearer', 'api-key-header'] as const;
const VALID_API_MODES = ['openai', 'native'] as const;

/**
 * Validate that an unknown input is a valid ProviderConfig.
 * Returns the validated config on success, or a list of errors on failure.
 */
export function validateProviderConfig(input: unknown): ConfigValidationResult {
  const errors: string[] = [];

  if (input === null || input === undefined || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be a non-null object'] };
  }

  const obj = input as Record<string, unknown>;

  // Check required string fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof obj[field] !== 'string') {
      errors.push(`Field '${field}' must be a string`);
    }
  }

  // Validate authType value
  if (typeof obj.authType === 'string' && !(VALID_AUTH_TYPES as readonly string[]).includes(obj.authType)) {
    errors.push(`Field 'authType' must be one of: ${VALID_AUTH_TYPES.join(', ')}`);
  }

  // Validate optional apiMode
  if ('apiMode' in obj && obj.apiMode !== undefined && obj.apiMode !== null) {
    if (typeof obj.apiMode !== 'string' || !(VALID_API_MODES as readonly string[]).includes(obj.apiMode)) {
      errors.push(`Field 'apiMode' must be one of: ${VALID_API_MODES.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    config: {
      name: obj.name as string,
      apiUrl: obj.apiUrl as string,
      authType: obj.authType as 'bearer' | 'api-key-header',
      apiKeyEnvVar: obj.apiKeyEnvVar as string,
      ...(obj.defaultHeaders !== undefined && { defaultHeaders: obj.defaultHeaders as Record<string, string> }),
      ...(obj.apiMode !== undefined && { apiMode: obj.apiMode as 'openai' | 'native' }),
    },
  };
}
