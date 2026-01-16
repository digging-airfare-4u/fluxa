/**
 * Feature: image-generation-refactor
 * Property 1: Provider Factory Returns Valid Provider
 * Validates: Requirements 1.4
 *
 * For any supported model name in the provider registry, the
 * ProviderFactory.getProvider(modelName) method SHALL return an object
 * that implements the ImageProvider interface with a valid generate method.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Import provider types and factory
import {
  type ImageProvider,
  GEMINI_MODELS,
  VOLCENGINE_MODELS,
  ProviderFactory,
  isGeminiModel,
  isVolcengineModel,
} from '../../supabase/functions/_shared/providers/index';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: vi.fn().mockReturnThis(),
    upload: vi.fn().mockResolvedValue({ error: null }),
  },
} as unknown as Parameters<typeof ProviderFactory>[0];

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 1: Provider Factory Returns Valid Provider', () => {
  let factory: InstanceType<typeof ProviderFactory>;

  beforeEach(() => {
    factory = new ProviderFactory(mockSupabaseClient);
  });

  /**
   * Arbitrary for supported model names
   */
  const supportedModelArb = fc.oneof(
    ...Object.keys(GEMINI_MODELS).map(model => fc.constant(model)),
    ...Object.keys(VOLCENGINE_MODELS).map(model => fc.constant(model))
  );

  it('should return a valid ImageProvider for any supported model', () => {
    fc.assert(
      fc.property(supportedModelArb, (modelName) => {
        const provider = factory.getProvider(modelName);

        // Verify provider implements ImageProvider interface
        expect(provider).toBeDefined();
        expect(typeof provider.name).toBe('string');
        expect(provider.name.length).toBeGreaterThan(0);
        expect(provider.capabilities).toBeDefined();
        expect(typeof provider.capabilities.supportsImageToImage).toBe('boolean');
        expect(typeof provider.capabilities.maxResolution).toBe('string');
        expect(Array.isArray(provider.capabilities.supportedAspectRatios)).toBe(true);
        expect(typeof provider.generate).toBe('function');
        expect(typeof provider.validateRequest).toBe('function');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return isSupported=true for any supported model', () => {
    fc.assert(
      fc.property(supportedModelArb, (modelName) => {
        expect(factory.isSupported(modelName)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should throw ProviderError for unsupported models', () => {
    // Arbitrary for unsupported model names
    const unsupportedModelArb = fc.string({ minLength: 1 }).filter(
      s => !factory.isSupported(s)
    );

    fc.assert(
      fc.property(unsupportedModelArb, (modelName) => {
        expect(() => factory.getProvider(modelName)).toThrow();
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return isSupported=false for unsupported models', () => {
    const unsupportedModelArb = fc.string({ minLength: 1 }).filter(
      s => !Object.keys(GEMINI_MODELS).includes(s) && !Object.keys(VOLCENGINE_MODELS).includes(s)
    );

    fc.assert(
      fc.property(unsupportedModelArb, (modelName) => {
        expect(factory.isSupported(modelName)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return default provider when no model specified', () => {
    const defaultProvider = factory.getDefaultProvider();

    expect(defaultProvider).toBeDefined();
    expect(defaultProvider.name).toBe('volcengine');
    expect(typeof defaultProvider.generate).toBe('function');
    expect(typeof defaultProvider.validateRequest).toBe('function');
  });

  it('should return correct provider type for Gemini models', () => {
    const geminiModelArb = fc.oneof(
      ...Object.keys(GEMINI_MODELS).map(model => fc.constant(model))
    );

    fc.assert(
      fc.property(geminiModelArb, (modelName) => {
        const provider = factory.getProvider(modelName);
        expect(provider.name).toBe(modelName);
        expect(isGeminiModel(modelName)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return correct provider type for Volcengine models', () => {
    const volcengineModelArb = fc.oneof(
      ...Object.keys(VOLCENGINE_MODELS).map(model => fc.constant(model))
    );

    fc.assert(
      fc.property(volcengineModelArb, (modelName) => {
        const provider = factory.getProvider(modelName);
        expect(provider.name).toBe('volcengine');
        expect(isVolcengineModel(modelName)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Provider Interface Compliance
// ============================================================================

describe('Provider Interface Compliance', () => {
  let factory: InstanceType<typeof ProviderFactory>;

  beforeEach(() => {
    factory = new ProviderFactory(mockSupabaseClient);
  });

  it('should have validateRequest method that returns ValidationResult', () => {
    const supportedModels = [
      ...Object.keys(GEMINI_MODELS),
      ...Object.keys(VOLCENGINE_MODELS),
    ];

    for (const modelName of supportedModels) {
      const provider = factory.getProvider(modelName);
      const result = provider.validateRequest({ prompt: 'test prompt' });

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    }
  });

  it('should validate empty prompt as invalid', () => {
    const supportedModels = [
      ...Object.keys(GEMINI_MODELS),
      ...Object.keys(VOLCENGINE_MODELS),
    ];

    for (const modelName of supportedModels) {
      const provider = factory.getProvider(modelName);
      const result = provider.validateRequest({ prompt: '' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should validate valid prompt as valid', () => {
    const supportedModels = [
      ...Object.keys(GEMINI_MODELS),
      ...Object.keys(VOLCENGINE_MODELS),
    ];

    for (const modelName of supportedModels) {
      const provider = factory.getProvider(modelName);
      const result = provider.validateRequest({ prompt: 'Generate a beautiful sunset' });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    }
  });
});

// ============================================================================
// Unit Tests for getSupportedModels
// ============================================================================

describe('ProviderFactory.getSupportedModels', () => {
  let factory: InstanceType<typeof ProviderFactory>;

  beforeEach(() => {
    factory = new ProviderFactory(mockSupabaseClient);
  });

  it('should return all registered models', () => {
    const models = factory.getSupportedModels();

    expect(models).toContain('gemini-2.5-flash-image');
    expect(models).toContain('gemini-3-pro-image-preview');
    expect(models).toContain('doubao-seedream-4-5-251128');
  });

  it('should return correct number of models', () => {
    const models = factory.getSupportedModels();
    const expectedCount = Object.keys(GEMINI_MODELS).length + Object.keys(VOLCENGINE_MODELS).length;

    expect(models.length).toBe(expectedCount);
  });
});
