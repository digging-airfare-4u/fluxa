/**
 * Feature: model-config-settings
 * Edge Error Contract Tests
 * Validates: Requirements 5.3, 7.2
 */

import { describe, expect, it } from 'vitest';
import {
  UserProviderConfigInvalidError,
  errorToResponse,
} from '../../supabase/functions/_shared/errors/index.ts';

describe('Edge invalid user provider config error contract', () => {
  it('should return USER_PROVIDER_CONFIG_INVALID with HTTP 400', async () => {
    const response = errorToResponse(
      new UserProviderConfigInvalidError(
        'Provider configuration not found or disabled. Please check your settings.',
        { configId: 'cfg-123' },
      ),
    );

    const body = await response.json() as {
      error: { code: string; message: string; details?: { configId?: string } };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('USER_PROVIDER_CONFIG_INVALID');
    expect(body.error.message).toBe(
      'Provider configuration not found or disabled. Please check your settings.',
    );
    expect(body.error.details?.configId).toBe('cfg-123');
  });
});
