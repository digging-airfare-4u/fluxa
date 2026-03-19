/**
 * Feature: model-config-settings
 * Revalidation Contract Tests
 * Validates: Requirements 4.10, 4.12, 4.13, 8.6
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';
import { validateProviderHostAsync } from '@/lib/security/provider-host-allowlist';
import { testProviderConnectivityWithTimeout } from '@/lib/security/provider-connectivity';

vi.mock('@/lib/security/provider-host-allowlist', () => ({
  validateProviderHostAsync: vi.fn(),
}));

vi.mock('@/lib/security/provider-connectivity', () => ({
  testProviderConnectivityWithTimeout: vi.fn(),
}));

vi.mock('@/lib/security/encryption', () => ({
  decryptApiKey: vi.fn(),
}));

const validateProviderHostAsyncMock = vi.mocked(validateProviderHostAsync);
const testProviderConnectivityWithTimeoutMock = vi.mocked(testProviderConnectivityWithTimeout);

function createMockClient(): SupabaseClient {
  return {} as SupabaseClient;
}

describe('Provider save-time revalidation contract', () => {
  const baseParams = {
    userClient: createMockClient(),
    serviceClient: createMockClient(),
    userId: 'user-1',
    apiUrl: 'https://api.example.com/v1',
    modelName: 'my-model',
    apiKey: 'sk-test-12345678',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail-closed when allowlist source is unavailable/empty', async () => {
    validateProviderHostAsyncMock.mockResolvedValue({
      valid: false,
      code: 'ALLOWLIST_EMPTY',
      reason: 'No provider hosts are configured in the allowlist',
      source: 'none',
      hostPort: 'api.example.com:443',
    });

    const result = await revalidateProviderConfigBeforeSave({
      userClient: createMockClient(),
      serviceClient: createMockClient(),
      userId: 'user-1',
      apiUrl: 'https://api.example.com/v1',
      modelName: 'my-model',
      apiKey: 'sk-test-12345678',
    });

    expect(result).toEqual({
      success: false,
      status: 503,
      code: 'ALLOWLIST_UNAVAILABLE',
      message:
        'Provider host allowlist is unavailable or empty. Please contact administrator.',
    });
    expect(testProviderConnectivityWithTimeoutMock).not.toHaveBeenCalled();
  });

  it('should require configId when apiKey is omitted in edit flow', async () => {
    validateProviderHostAsyncMock.mockResolvedValue({
      valid: true,
      hostPort: 'api.example.com:443',
      source: 'env',
    });

    const result = await revalidateProviderConfigBeforeSave({
      userClient: createMockClient(),
      serviceClient: createMockClient(),
      userId: 'user-1',
      apiUrl: 'https://api.example.com/v1',
      modelName: 'my-model',
      apiKey: '   ',
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      code: 'CONFIG_ID_REQUIRED',
      message: 'configId is required when apiKey is omitted',
    });
    expect(testProviderConnectivityWithTimeoutMock).not.toHaveBeenCalled();
  });

  it('should fail fast on timeout without automatic retry', async () => {
    validateProviderHostAsyncMock.mockResolvedValue({
      valid: true,
      hostPort: 'api.example.com:443',
      source: 'system_settings',
    });
    testProviderConnectivityWithTimeoutMock.mockResolvedValue({
      success: false,
      timedOut: true,
      message: 'Validation timeout after 12000ms',
    });

    const result = await revalidateProviderConfigBeforeSave({
      userClient: createMockClient(),
      serviceClient: createMockClient(),
      userId: 'user-1',
      apiUrl: 'https://api.example.com/v1',
      modelName: 'my-model',
      apiKey: 'sk-test-12345678',
    });

    expect(result).toEqual({
      success: false,
      status: 504,
      code: 'REVALIDATION_TIMEOUT',
      message: 'Validation timeout after 12000ms',
    });
    expect(testProviderConnectivityWithTimeoutMock).toHaveBeenCalledTimes(1);
  });

  it('should pass trimmed values into final connectivity test', async () => {
    validateProviderHostAsyncMock.mockResolvedValue({
      valid: true,
      hostPort: 'api.example.com:443',
      source: 'env',
    });
    testProviderConnectivityWithTimeoutMock.mockResolvedValue({
      success: true,
    });

    const result = await revalidateProviderConfigBeforeSave({
      userClient: createMockClient(),
      serviceClient: createMockClient(),
      userId: 'user-1',
      provider: 'openai-compatible',
      apiUrl: '  https://api.example.com/v1  ',
      modelName: '  my-model  ',
      apiKey: '  sk-test-12345678  ',
    });

    expect(result).toEqual({ success: true });
    expect(testProviderConnectivityWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(testProviderConnectivityWithTimeoutMock).toHaveBeenCalledWith({
      provider: 'openai-compatible',
      apiUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test-12345678',
      modelName: 'my-model',
      timeoutMs: expect.any(Number),
    });
  });

  it('should dispatch anthropic-compatible provider into connectivity revalidation', async () => {
    validateProviderHostAsyncMock.mockResolvedValue({
      valid: true,
      hostPort: 'api.minimaxi.com:443',
      source: 'env',
    });
    testProviderConnectivityWithTimeoutMock.mockResolvedValue({ success: true });

    await revalidateProviderConfigBeforeSave({
      provider: 'anthropic-compatible',
      ...baseParams,
    });

    expect(testProviderConnectivityWithTimeoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic-compatible' }),
    );
  });
});
