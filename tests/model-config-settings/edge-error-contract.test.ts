/**
 * Feature: model-config-settings
 * Edge Error Contract Tests
 * Validates: Requirements 5.3, 7.2
 */

import { describe, expect, it } from 'vitest';
import {
  ProviderError,
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

  it('maps overloaded provider responses to a temporary busy message', async () => {
    const response = errorToResponse(
      new ProviderError(
        'Anthropic-compatible API error: 529 - {"type":"error","error":{"type":"overloaded_error","message":"overloaded_error (529)"},"request_id":"req_529"}',
        'API_ERROR',
        {
          status: 529,
          body: '{"type":"error","error":{"type":"overloaded_error","message":"overloaded_error (529)"},"request_id":"req_529"}',
        },
        'user-configured:anthropic-compatible',
        'MiniMax Brain',
        529,
      ),
    );

    const body = await response.json() as {
      error: { code: string; message: string; provider_code?: string; http_status?: number };
    };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe('PROVIDER_ERROR');
    expect(body.error.message).toBe('Model service is temporarily busy. Please try again in a moment.');
    expect(body.error.provider_code).toBe('API_ERROR');
  });
});
