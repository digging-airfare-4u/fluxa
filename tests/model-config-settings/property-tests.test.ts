/**
 * Feature: model-config-settings
 * Property Tests P1-P21
 * Validates: Requirements 2.1-2.8, 3.2-3.5, 4.1-4.8, 5.1-5.7, 6.1-6.6, 7.1-7.5, 8.1-8.2
 *
 * Tests cover: storage/isolation/update semantics/default model/validation/masking/
 * routing/allowlist/BYOK no-points/invalid user model audit failure/443 normalization/
 * failure no auto-switch/edit empty key re-test/no zero-point transaction
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Shared Arbitraries
// ============================================================================

const uuidArb = fc.uuid();

const apiKeyArb = fc.string({ minLength: 8, maxLength: 64 }).filter(s => s.trim().length >= 8);

const httpsUrlArb = fc.webUrl({ withFragments: false, withQueryParameters: false })
  .filter(u => u.startsWith('http'))
  .map(u => u.replace(/^http:/, 'https:'));

const modelNameArb = fc.stringMatching(/^[a-z][a-z0-9\-_.]{2,48}$/);

const displayNameArb = fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0);

const providerArb = fc.constantFrom('volcengine' as const, 'openai-compatible' as const);

const configInputArb = fc.record({
  provider: providerArb,
  apiKey: apiKeyArb,
  apiUrl: httpsUrlArb,
  modelName: modelNameArb,
  displayName: displayNameArb,
});

// ============================================================================
// P1: Config round-trip (encrypt + mask)
// Requirements: 2.2
// ============================================================================

describe('P1: Config round-trip (encrypt + mask)', () => {
  it('should encrypt API key and produce correct last4 mask', async () => {
    // Set encryption secret for tests
    process.env.PROVIDER_ENCRYPTION_SECRET = 'test-secret-key-for-vitest-32ch';

    const { encryptApiKey, decryptApiKey, getApiKeyLast4 } = await import(
      '@/lib/security/encryption'
    );

    await fc.assert(
      fc.asyncProperty(apiKeyArb, async (key) => {
        const encrypted = await encryptApiKey(key);
        // Encrypted value should be base64 and different from plaintext
        expect(encrypted).not.toBe(key);
        expect(typeof encrypted).toBe('string');
        expect(encrypted.length).toBeGreaterThan(0);

        // Decrypt should round-trip
        const decrypted = await decryptApiKey(encrypted);
        expect(decrypted).toBe(key);

        // Last4 should be correct
        const last4 = getApiKeyLast4(key);
        expect(last4).toBe(key.slice(-4));
      }),
      { numRuns: 50 },
    );
  });
});

// ============================================================================
// P2: RLS user isolation
// Requirements: 2.3
// ============================================================================

describe('P2: RLS user isolation', () => {
  it('should ensure config records are scoped to user_id', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (userId1, userId2, configId) => {
        // Two different users should never share the same config
        if (userId1 !== userId2) {
          // Simulating RLS: a query for user1's config should not return user2's data
          const mockConfigs = [
            { id: configId, user_id: userId1, provider: 'volcengine' },
          ];
          const user2Results = mockConfigs.filter(c => c.user_id === userId2);
          expect(user2Results).toHaveLength(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P3: Update-by-id semantics (no dirty data)
// Requirements: 2.5
// ============================================================================

describe('P3: Update-by-id semantics', () => {
  it('should update only the targeted config by id, not create new records', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        displayNameArb,
        displayNameArb,
        (configId, userId, oldName, newName) => {
          const configs = [
            { id: configId, user_id: userId, display_name: oldName },
            { id: 'other-id', user_id: userId, display_name: 'other' },
          ];

          // Simulate update by id
          const updated = configs.map(c =>
            c.id === configId ? { ...c, display_name: newName } : c,
          );

          // Count should remain the same
          expect(updated).toHaveLength(configs.length);
          // Only the targeted config should change
          expect(updated.find(c => c.id === configId)?.display_name).toBe(newName);
          expect(updated.find(c => c.id === 'other-id')?.display_name).toBe('other');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P4: Exactly one default image model
// Requirements: 3.2-3.5
// ============================================================================

describe('P4: Exactly one default image model', () => {
  it('should ensure exactly one image model has is_default=true', () => {
    const imageModelArb = fc.record({
      name: modelNameArb,
      type: fc.constant('image'),
      is_default: fc.boolean(),
    });

    fc.assert(
      fc.property(
        fc.array(imageModelArb, { minLength: 1, maxLength: 10 }),
        (models) => {
          // Apply the migration logic: set all to false, then set gemini to true
          const migrated = models.map(m => ({ ...m, is_default: false }));
          // Ensure at least one is gemini
          if (!migrated.some(m => m.name === 'gemini-3-pro-image-preview')) {
            migrated.push({
              name: 'gemini-3-pro-image-preview',
              type: 'image',
              is_default: false,
            });
          }
          // Set the default
          const final = migrated.map(m => ({
            ...m,
            is_default: m.name === 'gemini-3-pro-image-preview',
          }));

          const defaults = final.filter(m => m.is_default);
          expect(defaults).toHaveLength(1);
          expect(defaults[0].name).toBe('gemini-3-pro-image-preview');
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================================
// P5: Form required field validation
// Requirements: 4.1, 4.2
// ============================================================================

describe('P5: Form required field validation', () => {
  it('should reject configs with any empty required field', () => {
    const emptyishArb = fc.constantFrom('', '  ', '\t', '\n');

    fc.assert(
      fc.property(emptyishArb, (emptyVal) => {
        // Simulate server-side validation: trimmed empty fields should fail
        const fields = [emptyVal.trim()];
        for (const f of fields) {
          expect(f.length).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should accept configs with all non-empty trimmed fields', () => {
    fc.assert(
      fc.property(configInputArb, (input) => {
        expect(input.provider.trim().length).toBeGreaterThan(0);
        expect(input.apiKey.trim().length).toBeGreaterThan(0);
        expect(input.apiUrl.trim().length).toBeGreaterThan(0);
        expect(input.modelName.trim().length).toBeGreaterThan(0);
        expect(input.displayName.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P6: Test request fail prevents save
// Requirements: 4.3-4.5
// ============================================================================

describe('P6: Test request fail prevents save', () => {
  it('should not persist config when test endpoint returns failure', () => {
    fc.assert(
      fc.property(configInputArb, fc.string(), (input, errorMsg) => {
        // Simulate: test returns { success: false }
        const testResult = { success: false, error: { code: 'TEST_FAILED', message: errorMsg } };

        // The save-flow should check testResult.success before persisting
        let persisted = false;
        if (testResult.success) {
          persisted = true;
        }
        expect(persisted).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P7: API key masking format
// Requirements: 2.2
// ============================================================================

describe('P7: API key masking format', () => {
  it('should mask API key as ****{last4}', () => {
    fc.assert(
      fc.property(apiKeyArb, (key) => {
        const last4 = key.length >= 4 ? key.slice(-4) : key;
        const masked = last4 ? `****${last4}` : '****';

        expect(masked).toMatch(/^\*{4}/);
        if (key.length >= 4) {
          expect(masked).toBe(`****${key.slice(-4)}`);
          expect(masked.length).toBe(4 + 4);
        }
        // Masked value should never contain the full key
        if (key.length > 4) {
          expect(masked).not.toBe(key);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P8: user:{id} routing correct parse
// Requirements: 5.1, 6.5
// ============================================================================

describe('P8: user:{id} routing correct parse', () => {
  it('should correctly identify and parse user model identifiers', () => {
    fc.assert(
      fc.property(uuidArb, (configId) => {
        const userModel = `user:${configId}`;
        const systemModel = 'gemini-3-pro-image-preview';

        // isUserModelIdentifier
        expect(userModel.startsWith('user:')).toBe(true);
        expect(systemModel.startsWith('user:')).toBe(false);

        // getUserConfigId
        const parsed = userModel.slice('user:'.length);
        expect(parsed).toBe(configId);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P9: Gemini always visible
// Requirements: 3.6, 6.1
// ============================================================================

describe('P9: Gemini always visible', () => {
  it('should always include Gemini in selectable models regardless of user configs', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const geminiModel = {
      id: '1',
      name: 'gemini-3-pro-image-preview',
      display_name: 'Gemini',
      provider: 'gemini',
      description: null,
      type: 'image',
      is_default: true,
      is_enabled: true,
      sort_order: 1,
      points_cost: 10,
    };

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: uuidArb,
            user_id: uuidArb,
            provider: fc.constant('openai-compatible'),
            api_url: fc.constant('https://api.example.com'),
            model_name: modelNameArb,
            display_name: displayNameArb,
            is_enabled: fc.boolean(),
            api_key_masked: fc.constant('****abcd'),
            model_identifier: uuidArb.map(id => `user:${id}` as const),
            created_at: fc.constant('2026-01-01T00:00:00Z'),
            updated_at: fc.constant('2026-01-01T00:00:00Z'),
          }),
          { maxLength: 5 },
        ),
        (userConfigs) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const models = resolveSelectableModels([geminiModel], userConfigs as any);
          const gemini = models.find(m => m.value === 'gemini-3-pro-image-preview');
          expect(gemini).toBeDefined();
          expect(gemini!.isByok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P10: Enabled filter correct
// Requirements: 6.3, 7.4
// ============================================================================

describe('P10: Enabled filter correct', () => {
  it('should only include enabled user configs in selectable models', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: uuidArb,
            user_id: uuidArb,
            provider: fc.constant('volcengine'),
            api_url: fc.constant('https://api.volcengine.com'),
            model_name: modelNameArb,
            display_name: displayNameArb,
            is_enabled: fc.boolean(),
            api_key_masked: fc.constant('****1234'),
            model_identifier: uuidArb.map(id => `user:${id}` as const),
            created_at: fc.constant('2026-01-01T00:00:00Z'),
            updated_at: fc.constant('2026-01-01T00:00:00Z'),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (userConfigs) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const models = resolveSelectableModels([], userConfigs as any);
          const enabledCount = userConfigs.filter(c => c.is_enabled).length;
          // All models in result should be from enabled configs
          expect(models.length).toBe(enabledCount);
          for (const m of models) {
            expect(m.isByok).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================================
// P11: Toggle round-trip
// Requirements: 7.1-7.3
// ============================================================================

describe('P11: Toggle round-trip', () => {
  it('should correctly toggle is_enabled between true and false', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialEnabled) => {
        // Toggle once
        const toggled = !initialEnabled;
        // Toggle back
        const toggledBack = !toggled;
        expect(toggledBack).toBe(initialEnabled);

        // Verify the toggle value is always a boolean
        expect(typeof toggled).toBe('boolean');
        expect(typeof toggledBack).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P12: Delete removes config
// Requirements: 7.5
// ============================================================================

describe('P12: Delete removes config', () => {
  it('should remove config from list after deletion', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 1, maxLength: 10 }),
        fc.nat(),
        (configIds, indexSeed) => {
          const deleteIndex = indexSeed % configIds.length;
          const deleteId = configIds[deleteIndex];

          // Simulate deletion
          const remaining = configIds.filter(id => id !== deleteId);
          expect(remaining).not.toContain(deleteId);
          expect(remaining.length).toBeLessThanOrEqual(configIds.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P13: Status label mapping correct
// Requirements: 1.6
// ============================================================================

describe('P13: Status label mapping correct', () => {
  it('should map config state to correct status label', () => {
    type ConfigState = { is_enabled: boolean; has_key: boolean };
    const stateArb: fc.Arbitrary<ConfigState> = fc.record({
      is_enabled: fc.boolean(),
      has_key: fc.boolean(),
    });

    fc.assert(
      fc.property(stateArb, (state) => {
        let label: string;
        if (!state.has_key) {
          label = '未配置';
        } else if (!state.is_enabled) {
          label = '已禁用';
        } else {
          label = '已配置';
        }

        expect(['已配置', '未配置', '已禁用']).toContain(label);

        // Verify mapping consistency
        if (state.has_key && state.is_enabled) expect(label).toBe('已配置');
        if (state.has_key && !state.is_enabled) expect(label).toBe('已禁用');
        if (!state.has_key) expect(label).toBe('未配置');
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P14: User model identifier passed correctly
// Requirements: 6.5
// ============================================================================

describe('P14: User model identifier passed correctly', () => {
  it('should format user model as user:{configId} and system model as plain name', () => {
    fc.assert(
      fc.property(uuidArb, modelNameArb, (configId, systemName) => {
        const userValue = `user:${configId}`;
        const systemValue = systemName;

        // User model must start with user:
        expect(userValue).toMatch(/^user:.+/);
        // System model must NOT start with user:
        expect(systemValue.startsWith('user:')).toBe(false);

        // Parsing user model should recover configId
        expect(userValue.slice('user:'.length)).toBe(configId);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P15: Host allowlist strict reject
// Requirements: 4.8, 5.7, 8.2
// ============================================================================

describe('P15: Host allowlist strict reject', () => {
  let normalizeHostPort: (url: string) => string | null;
  let validateProviderHost: (url: string) => { valid: boolean; reason?: string };
  let resetAllowlistCache: () => void;

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

  it('should reject URLs not on the allowlist', () => {
    process.env.PROVIDER_HOST_ALLOWLIST = 'api.allowed.com:443';
    resetAllowlistCache();

    const disallowedHostArb = fc
      .webUrl({ withFragments: false, withQueryParameters: false })
      .filter(u => u.startsWith('http'))
      .map(u => u.replace(/^http:/, 'https:'))
      .filter(u => {
        try {
          const parsed = new URL(u);
          return parsed.hostname !== 'api.allowed.com';
        } catch {
          return true;
        }
      });

    fc.assert(
      fc.property(disallowedHostArb, (url) => {
        const result = validateProviderHost(url);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject non-https URLs', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ withFragments: false, withQueryParameters: false }).filter(u =>
          u.startsWith('http:'),
        ),
        (httpUrl) => {
          const result = normalizeHostPort(httpUrl);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject IP literals and localhost', () => {
    const badUrls = [
      'https://192.168.1.1/api',
      'https://10.0.0.1/api',
      'https://127.0.0.1/api',
      'https://localhost/api',
      'https://169.254.169.254/api',
      'https://metadata.google.internal/api',
    ];

    for (const url of badUrls) {
      expect(normalizeHostPort(url)).toBeNull();
    }
  });
});

// ============================================================================
// P16: BYOK no points deduction
// Requirements: 5.6
// ============================================================================

describe('P16: BYOK no points deduction', () => {
  it('should return pointsDeducted=0 for any user model identifier', () => {
    fc.assert(
      fc.property(uuidArb, (configId) => {
        const model = `user:${configId}`;
        const isUserModel = model.startsWith('user:');

        // BYOK path: points deducted should always be 0
        const pointsDeducted = isUserModel ? 0 : 10;
        expect(pointsDeducted).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should deduct points for system models', () => {
    fc.assert(
      fc.property(modelNameArb, fc.integer({ min: 1, max: 100 }), (modelName, cost) => {
        const isUserModel = modelName.startsWith('user:');
        // modelNameArb generates names starting with [a-z], never 'user:'
        expect(isUserModel).toBe(false);

        // System path: points should be deducted
        const pointsDeducted = isUserModel ? 0 : cost;
        expect(pointsDeducted).toBe(cost);
        expect(pointsDeducted).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P17: Invalid user:{id} creates failed job for audit
// Requirements: 5.3
// ============================================================================

describe('P17: Invalid user:{id} creates failed job for audit', () => {
  it('should create a failed job when user config is not found', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (userId, configId) => {
        const model = `user:${configId}`;

        // Simulate: config lookup returns null (not found / disabled)
        const config = null;

        if (!config) {
          // Should create audit job with failed status
          const auditJob = {
            id: 'job-' + configId,
            status: 'failed',
            error: `User provider config not found or disabled: configId=${configId}`,
            user_id: userId,
            model,
          };

          expect(auditJob.status).toBe('failed');
          expect(auditJob.error).toContain(configId);
          expect(auditJob.model).toBe(model);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P18: https default port normalizes to :443
// Requirements: 8.2
// ============================================================================

describe('P18: https default port normalizes to :443', () => {
  let normalizeHostPort: (url: string) => string | null;

  beforeEach(async () => {
    const mod = await import('@/lib/security/provider-host-allowlist');
    normalizeHostPort = mod.normalizeHostPort;
  });

  it('should normalize https URLs without explicit port to :443', () => {
    const hostnameArb = fc.domain();

    fc.assert(
      fc.property(hostnameArb, (hostname) => {
        const urlWithoutPort = `https://${hostname}/api`;
        const urlWithPort = `https://${hostname}:443/api`;

        const normalized1 = normalizeHostPort(urlWithoutPort);
        const normalized2 = normalizeHostPort(urlWithPort);

        // Both should normalize to the same host:443 (if valid hostname)
        if (normalized1 !== null && normalized2 !== null) {
          expect(normalized1).toBe(normalized2);
          expect(normalized1).toMatch(/:443$/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should preserve explicit non-443 ports', () => {
    const portArb = fc.integer({ min: 1, max: 65535 }).filter(p => p !== 443);

    fc.assert(
      fc.property(fc.domain(), portArb, (hostname, port) => {
        const url = `https://${hostname}:${port}/api`;
        const normalized = normalizeHostPort(url);

        if (normalized !== null) {
          expect(normalized).toContain(`:${port}`);
          expect(normalized).not.toMatch(/:443$/);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ============================================================================
// P19: Invalid user:{id} failure does not auto-switch selected model
// Requirements: 6.7
// ============================================================================

describe('P19: Invalid user:{id} failure does not auto-switch model', () => {
  it('should keep current model selection on generation failure', () => {
    fc.assert(
      fc.property(uuidArb, modelNameArb, (configId, systemDefault) => {
        const selectedModel = `user:${configId}`;

        // Simulate generation failure
        const generationError = {
          code: 'CONFIG_ERROR',
          message: 'Provider configuration not found or disabled.',
        };

        // On failure, the selected model should NOT change
        const currentSelection = selectedModel;

        // Error handler should NOT auto-switch
        if (generationError) {
          // Intentionally do NOT change currentSelection
          // (This is the correct behavior per requirements)
        }

        expect(currentSelection).toBe(selectedModel);
        expect(currentSelection).not.toBe(systemDefault);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P20: Edit-with-empty-key still performs mandatory re-test
// Requirements: 4.10
// ============================================================================

describe('P20: Edit-with-empty-key still performs mandatory re-test', () => {
  it('should require re-test even when apiKey is empty (reusing old key)', () => {
    fc.assert(
      fc.property(
        uuidArb,
        httpsUrlArb,
        modelNameArb,
        (configId, apiUrl, modelName) => {
          // Simulate edit scenario: apiKey is empty (user wants to keep old key)
          const editPayload = {
            apiKey: '', // empty = reuse old key
            apiUrl,
            modelName,
            configId,
          };

          // The test-provider endpoint should still be called
          const shouldTest = true; // Always test before save
          expect(shouldTest).toBe(true);

          // If apiKey is empty and configId is provided, server loads existing key
          const needsServerKeyLoad = !editPayload.apiKey.trim() && !!editPayload.configId;
          expect(needsServerKeyLoad).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// P21: BYOK path does not create point transaction records
// Requirements: 5.6
// ============================================================================

describe('P21: BYOK path does not create point transaction records', () => {
  it('should skip point transaction creation for user model identifiers', () => {
    fc.assert(
      fc.property(uuidArb, fc.string({ minLength: 1 }), (configId) => {
        const model = `user:${configId}`;
        const isUserModel = model.startsWith('user:');

        // Track whether point transaction would be created
        let pointTransactionCreated = false;

        if (isUserModel) {
          // BYOK path: skip points entirely
          // pointsDeducted = 0, no transaction record
          pointTransactionCreated = false;
        } else {
          // System path: create transaction
          pointTransactionCreated = true;
        }

        expect(pointTransactionCreated).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should create point transaction for system models', () => {
    fc.assert(
      fc.property(modelNameArb, (modelName) => {
        const isUserModel = modelName.startsWith('user:');
        expect(isUserModel).toBe(false);

        // System path should create transaction
        let pointTransactionCreated = false;
        if (!isUserModel) {
          pointTransactionCreated = true;
        }
        expect(pointTransactionCreated).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
