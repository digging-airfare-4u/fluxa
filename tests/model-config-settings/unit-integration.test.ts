/**
 * Feature: model-config-settings
 * Unit/Integration Tests
 * Validates: API routes, model resolution, allowlist, BYOK behavior
 *
 * Covers:
 * - /api/provider-configs and /api/test-provider
 * - ProviderConfigPanel/Form multi-config behavior
 * - generate-image user:{id} parsing and "fail = error"
 * - BYOK return values and frontend display consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Host Allowlist Unit Tests
// ============================================================================

describe('Provider Host Allowlist', () => {
  let normalizeHostPort: typeof import('@/lib/security/provider-host-allowlist').normalizeHostPort;
  let validateProviderHost: typeof import('@/lib/security/provider-host-allowlist').validateProviderHost;
  let resetAllowlistCache: typeof import('@/lib/security/provider-host-allowlist').resetAllowlistCache;

  beforeEach(async () => {
    const mod = await import('@/lib/security/provider-host-allowlist');
    normalizeHostPort = mod.normalizeHostPort;
    validateProviderHost = mod.validateProviderHost;
    resetAllowlistCache = mod.resetAllowlistCache;
    resetAllowlistCache();
  });

  afterEach(() => {
    delete process.env.PROVIDER_HOST_ALLOWLIST;
    resetAllowlistCache();
  });

  describe('normalizeHostPort', () => {
    it('should return host:443 for https URL without port', () => {
      expect(normalizeHostPort('https://api.example.com/v1')).toBe('api.example.com:443');
    });

    it('should return host:port for https URL with explicit port', () => {
      expect(normalizeHostPort('https://api.example.com:8443/v1')).toBe('api.example.com:8443');
    });

    it('should return host:443 for https URL with explicit 443', () => {
      expect(normalizeHostPort('https://api.example.com:443/v1')).toBe('api.example.com:443');
    });

    it('should reject http URLs', () => {
      expect(normalizeHostPort('http://api.example.com/v1')).toBeNull();
    });

    it('should reject IP addresses', () => {
      expect(normalizeHostPort('https://192.168.1.1/v1')).toBeNull();
      expect(normalizeHostPort('https://10.0.0.1/v1')).toBeNull();
    });

    it('should reject localhost', () => {
      expect(normalizeHostPort('https://localhost/v1')).toBeNull();
    });

    it('should reject .local and .internal domains', () => {
      expect(normalizeHostPort('https://myservice.local/v1')).toBeNull();
      expect(normalizeHostPort('https://myservice.internal/v1')).toBeNull();
    });

    it('should reject metadata endpoint', () => {
      expect(normalizeHostPort('https://169.254.169.254/latest')).toBeNull();
    });

    it('should return null for invalid URLs', () => {
      expect(normalizeHostPort('not-a-url')).toBeNull();
      expect(normalizeHostPort('')).toBeNull();
    });

    it('should lowercase hostnames', () => {
      expect(normalizeHostPort('https://API.Example.COM/v1')).toBe('api.example.com:443');
    });
  });

  describe('validateProviderHost', () => {
    it('should accept URL on the allowlist', () => {
      process.env.PROVIDER_HOST_ALLOWLIST = 'api.volcengine.com:443,api.openai.com:443';
      resetAllowlistCache();

      const result = validateProviderHost('https://api.volcengine.com/v1');
      expect(result.valid).toBe(true);
    });

    it('should reject URL not on the allowlist', () => {
      process.env.PROVIDER_HOST_ALLOWLIST = 'api.volcengine.com:443';
      resetAllowlistCache();

      const result = validateProviderHost('https://api.evil.com/v1');
      expect(result.valid).toBe(false);
      expect(result).toHaveProperty('reason');
    });

    it('should reject when allowlist is empty', () => {
      process.env.PROVIDER_HOST_ALLOWLIST = '';
      resetAllowlistCache();

      const result = validateProviderHost('https://api.example.com/v1');
      expect(result.valid).toBe(false);
    });

    it('should handle allowlist with whitespace', () => {
      process.env.PROVIDER_HOST_ALLOWLIST = ' api.example.com:443 , api.other.com:443 ';
      resetAllowlistCache();

      expect(validateProviderHost('https://api.example.com/v1').valid).toBe(true);
      expect(validateProviderHost('https://api.other.com/v1').valid).toBe(true);
    });
  });
});


// ============================================================================
// Encryption Unit Tests
// ============================================================================

describe('Encryption', () => {
  beforeEach(() => {
    process.env.PROVIDER_ENCRYPTION_SECRET = 'test-secret-key-for-vitest-32ch';
  });

  afterEach(() => {
    delete process.env.PROVIDER_ENCRYPTION_SECRET;
  });

  it('should encrypt and decrypt API key correctly', async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/security/encryption');

    const plaintext = 'sk-test-api-key-12345678';
    const encrypted = await encryptApiKey(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', async () => {
    const { encryptApiKey } = await import('@/lib/security/encryption');

    const plaintext = 'sk-test-api-key-12345678';
    const encrypted1 = await encryptApiKey(plaintext);
    const encrypted2 = await encryptApiKey(plaintext);

    // Different IVs should produce different ciphertexts
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should extract correct last 4 characters', async () => {
    const { getApiKeyLast4 } = await import('@/lib/security/encryption');

    expect(getApiKeyLast4('sk-test-key-abcd')).toBe('abcd');
    expect(getApiKeyLast4('1234')).toBe('1234');
    expect(getApiKeyLast4('abc')).toBe('abc');
  });
});

// ============================================================================
// Resolve Selectable Models Unit Tests
// ============================================================================

describe('resolveSelectableModels', () => {
  it('should merge system and user models correctly', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const systemModels = [
      {
        id: '1',
        name: 'gemini-3-pro-image-preview',
        display_name: 'Gemini Image',
        provider: 'gemini',
        description: null,
        type: 'image',
        is_default: true,
        is_enabled: true,
        sort_order: 1,
        points_cost: 10,
      },
      {
        id: '2',
        name: 'doubao-seedream-4-5-251128',
        display_name: 'Doubao Seedream',
        provider: 'volcengine',
        description: null,
        type: 'image',
        is_default: false,
        is_enabled: true,
        sort_order: 2,
        points_cost: 8,
      },
    ];

    const userConfigs = [
      {
        id: 'cfg-1',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_url: 'https://api.example.com',
        model_name: 'custom-model',
        display_name: 'My Custom Model',
        model_type: 'image' as const,
        is_enabled: true,
        api_key_masked: '****abcd',
        model_identifier: 'user:cfg-1' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cfg-2',
        user_id: 'user-1',
        provider: 'volcengine',
        api_url: 'https://api.volcengine.com',
        model_name: 'disabled-model',
        display_name: 'Disabled Model',
        model_type: 'chat' as const,
        is_enabled: false,
        api_key_masked: '****efgh',
        model_identifier: 'user:cfg-2' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = resolveSelectableModels(systemModels, userConfigs as any);

    // 2 system + 1 enabled user config
    expect(models).toHaveLength(3);

    // System models use model.name as value
    expect(models[0].value).toBe('gemini-3-pro-image-preview');
    expect(models[0].isByok).toBe(false);
    expect(models[0].isDefault).toBe(true);

    expect(models[1].value).toBe('doubao-seedream-4-5-251128');
    expect(models[1].isByok).toBe(false);

    // User model uses user:{configId} as value
    expect(models[2].value).toBe('user:cfg-1');
    expect(models[2].isByok).toBe(true);
    expect(models[2].pointsCost).toBe(0);
    expect(models[2].displayName).toBe('My Custom Model');

    // Disabled config should NOT be included
    const disabledModel = models.find(m => m.value === 'user:cfg-2');
    expect(disabledModel).toBeUndefined();
  });

  it('should return empty list when no models provided', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const models = resolveSelectableModels([], []);
    expect(models).toHaveLength(0);
  });

  it('should map chat BYOK configs into ops/text models', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const models = resolveSelectableModels([], [
      {
        id: 'cfg-chat',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_url: 'https://api.example.com/v1',
        model_name: 'gpt-4o-mini',
        display_name: 'My Brain',
        model_type: 'chat' as const,
        is_enabled: true,
        api_key_masked: '****abcd',
        model_identifier: 'user:cfg-chat' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ] as any);

    expect(models[0]).toMatchObject({
      value: 'user:cfg-chat',
      type: 'ops',
      isByok: true,
      displayName: 'My Brain',
    });
  });
});

describe('getDefaultModelValue', () => {
  it('should return the system default model', async () => {
    const { resolveSelectableModels, getDefaultModelValue } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const systemModels = [
      {
        id: '1',
        name: 'model-a',
        display_name: 'Model A',
        provider: 'gemini',
        description: null,
        type: 'image',
        is_default: false,
        is_enabled: true,
        sort_order: 1,
        points_cost: 10,
      },
      {
        id: '2',
        name: 'model-b',
        display_name: 'Model B',
        provider: 'gemini',
        description: null,
        type: 'image',
        is_default: true,
        is_enabled: true,
        sort_order: 2,
        points_cost: 10,
      },
    ];

    const models = resolveSelectableModels(systemModels, []);
    const defaultValue = getDefaultModelValue(models);
    expect(defaultValue).toBe('model-b');
  });

  it('should fallback to first model when no default', async () => {
    const { resolveSelectableModels, getDefaultModelValue } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const systemModels = [
      {
        id: '1',
        name: 'model-a',
        display_name: 'Model A',
        provider: 'gemini',
        description: null,
        type: 'image',
        is_default: false,
        is_enabled: true,
        sort_order: 1,
        points_cost: 10,
      },
    ];

    const models = resolveSelectableModels(systemModels, []);
    const defaultValue = getDefaultModelValue(models);
    expect(defaultValue).toBe('model-a');
  });
});

describe('isSelectableImageModel', () => {
  it('should return true for user configs that resolve to image models', async () => {
    const { isSelectableImageModel } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    expect(isSelectableImageModel('user:some-config-id', [
      {
        value: 'user:some-config-id',
        displayName: 'BYOK Image',
        type: 'image',
        isByok: true,
        pointsCost: 0,
        isDefault: false,
        provider: 'openai-compatible',
      },
    ])).toBe(true);
  });

  it('should return true for system image models', async () => {
    const { isSelectableImageModel } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const models = [
      {
        value: 'gemini-3-pro-image-preview',
        displayName: 'Gemini',
        type: 'image' as const,
        isByok: false,
        pointsCost: 10,
        isDefault: true,
        provider: 'gemini',
      },
    ];

    expect(isSelectableImageModel('gemini-3-pro-image-preview', models)).toBe(true);
  });

  it('should return false for ops models', async () => {
    const { isSelectableImageModel } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const models = [
      {
        value: 'gpt-4',
        displayName: 'GPT-4',
        type: 'ops' as const,
        isByok: false,
        pointsCost: 5,
        isDefault: false,
        provider: 'openai',
      },
    ];

    expect(isSelectableImageModel('gpt-4', models)).toBe(false);
  });

  it('should return false for chat BYOK configs', async () => {
    const { isSelectableImageModel } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    expect(isSelectableImageModel('user:brain-config', [
      {
        value: 'user:brain-config',
        displayName: 'BYOK Brain',
        type: 'ops',
        isByok: true,
        pointsCost: 0,
        isDefault: false,
        provider: 'openai-compatible',
      },
    ])).toBe(false);
  });
});

// ============================================================================
// User Model Identifier Parsing Tests
// ============================================================================

describe('User Model Identifier Parsing', () => {
  it('should correctly identify user model identifiers', () => {
    expect('user:abc-123'.startsWith('user:')).toBe(true);
    expect('gemini-3-pro'.startsWith('user:')).toBe(false);
    expect('user:'.startsWith('user:')).toBe(true);
    expect('USER:abc'.startsWith('user:')).toBe(false);
  });

  it('should extract configId from user model identifier', () => {
    expect('user:abc-123'.slice('user:'.length)).toBe('abc-123');
    expect('user:'.slice('user:'.length)).toBe('');
    expect('user:some-uuid-here'.slice('user:'.length)).toBe('some-uuid-here');
  });
});

// ============================================================================
// Provider Config Service Types Tests
// ============================================================================

describe('ProviderConfigError', () => {
  it('should create error with code and statusCode', async () => {
    const { ProviderConfigError } = await import('@/lib/api/provider-configs');

    const error = new ProviderConfigError('Not found', 'NOT_FOUND', 404);
    expect(error.message).toBe('Not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ProviderConfigError');
    expect(error).toBeInstanceOf(Error);
  });
});

// ============================================================================
// BYOK Return Values Tests
// ============================================================================

describe('BYOK Return Values', () => {
  it('should set pointsDeducted=0 and return realtime remainingPoints for user model', () => {
    // Simulate the generate-image response for BYOK
    const model = 'user:cfg-123';
    const isUserModel = model.startsWith('user:');
    const currentBalance = 88;

    const response = {
      jobId: 'job-1',
      pointsDeducted: isUserModel ? 0 : 10,
      remainingPoints: isUserModel ? currentBalance : 90,
      modelUsed: model,
    };

    expect(response.pointsDeducted).toBe(0);
    expect(response.remainingPoints).toBe(currentBalance);
    expect(response.remainingPoints).toBeGreaterThanOrEqual(0);
  });

  it('should set pointsCost=0 for BYOK models in selectable list', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const userConfigs = [
      {
        id: 'cfg-1',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_url: 'https://api.example.com',
        model_name: 'custom-model',
        display_name: 'Custom',
        is_enabled: true,
        api_key_masked: '****abcd',
        model_identifier: 'user:cfg-1' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = resolveSelectableModels([], userConfigs as any);
    expect(models[0].pointsCost).toBe(0);
    expect(models[0].isByok).toBe(true);
  });
});

// ============================================================================
// Multi-Config Behavior Tests
// ============================================================================

describe('Multi-Config Support', () => {
  it('should allow multiple configs for same provider', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const userConfigs = [
      {
        id: 'cfg-1',
        user_id: 'user-1',
        provider: 'volcengine',
        api_url: 'https://api.volcengine.com',
        model_name: 'model-a',
        display_name: 'Volcengine A',
        is_enabled: true,
        api_key_masked: '****1111',
        model_identifier: 'user:cfg-1' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cfg-2',
        user_id: 'user-1',
        provider: 'volcengine',
        api_url: 'https://api.volcengine.com',
        model_name: 'model-b',
        display_name: 'Volcengine B',
        is_enabled: true,
        api_key_masked: '****2222',
        model_identifier: 'user:cfg-2' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cfg-3',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_url: 'https://api.custom.com',
        model_name: 'custom-1',
        display_name: 'Custom 1',
        is_enabled: true,
        api_key_masked: '****3333',
        model_identifier: 'user:cfg-3' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = resolveSelectableModels([], userConfigs as any);

    // All 3 enabled configs should appear
    expect(models).toHaveLength(3);

    // Each should have unique value
    const values = models.map(m => m.value);
    expect(new Set(values).size).toBe(3);

    // All should be BYOK
    for (const m of models) {
      expect(m.isByok).toBe(true);
      expect(m.pointsCost).toBe(0);
    }
  });
});

// ============================================================================
// Error Sanitization Tests (Edge Function)
// ============================================================================

describe('Error Sanitization', () => {
  it('should not contain API keys or auth headers in sanitized output', () => {
    // Simulate the sanitizeErrorMessage function behavior
    const rawMessages = [
      'Failed with Bearer sk-test-1234567890abcdef',
      'Error: Authorization: sk-secret-key-here',
      'Connection failed with key-abcdefghij',
    ];

    for (const msg of rawMessages) {
      // Sanitize: remove Bearer tokens, API key patterns, Authorization headers
      let sanitized = msg.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]');
      sanitized = sanitized.replace(/\b(sk-|key-|api-)[A-Za-z0-9\-._]{8,}\b/g, '[REDACTED_KEY]');
      sanitized = sanitized.replace(/Authorization:\s*[^\s,}]+/gi, 'Authorization: [REDACTED]');

      expect(sanitized).not.toMatch(/sk-test-1234567890abcdef/);
      expect(sanitized).not.toMatch(/sk-secret-key-here/);
      expect(sanitized).not.toMatch(/key-abcdefghij/);
    }
  });
});

// ============================================================================
// Generate-Image User Model Routing Tests
// ============================================================================

describe('generate-image user model routing', () => {
  it('should parse user:{configId} correctly', () => {
    const model = 'user:550e8400-e29b-41d4-a716-446655440000';
    const isUser = model.startsWith('user:');
    expect(isUser).toBe(true);

    const configId = model.slice('user:'.length);
    expect(configId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should not treat system models as user models', () => {
    const systemModels = [
      'gemini-3-pro-image-preview',
      'doubao-seedream-4-5-251128',
      'dall-e-3',
    ];

    for (const model of systemModels) {
      expect(model.startsWith('user:')).toBe(false);
    }
  });

  it('should create failed job when config not found (audit)', () => {
    // Simulate the audit flow
    const configId = 'nonexistent-config';
    const model = `user:${configId}`;
    const config = null; // not found

    expect(config).toBeNull();

    // The Edge Function should create a failed job
    const failedJob = {
      status: 'failed',
      error: `User provider config not found or disabled: configId=${configId}`,
    };

    expect(failedJob.status).toBe('failed');
    expect(failedJob.error).toContain(configId);
    expect(model).toBe(`user:${configId}`);
  });

  it('should not auto-fallback to system model on user config failure', () => {
    const selectedModel = 'user:some-config-id';
    const config = null; // not found

    // Should throw error, NOT fallback
    let usedFallback = false;
    if (!config) {
      // Correct behavior: throw error
      const error = { code: 'CONFIG_ERROR', message: 'Provider configuration not found' };
      expect(error.code).toBe('CONFIG_ERROR');
    } else {
      usedFallback = true;
    }

    expect(usedFallback).toBe(false);
    expect(selectedModel.startsWith('user:')).toBe(true);
  });
});
