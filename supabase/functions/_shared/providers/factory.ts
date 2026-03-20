/**
 * Provider Factory
 * Creates provider instances based on model name
 * Requirements: 1.4
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ProviderError } from '../errors/index.ts';
import {
  type ImageProvider,
  type GeminiModelName,
  GEMINI_MODELS,
  isGeminiModel,
  isVolcengineModel,
} from './types.ts';
import { GeminiProvider } from './gemini.ts';
import { VolcengineProvider } from './volcengine.ts';
import { DEFAULT_VOLCENGINE_IMAGE_MODEL } from '../defaults.ts';

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Factory for creating image generation provider instances
 * Requirements: 1.4
 */
export class ProviderFactory {
  private supabase: SupabaseClient;
  
  /**
   * Map of model names to provider factory functions
   */
  private providerFactories: Map<string, () => ImageProvider>;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    
    // Register all supported models
    this.providerFactories = new Map();
    
    // Register Gemini models
    for (const modelName of Object.keys(GEMINI_MODELS)) {
      this.providerFactories.set(
        modelName,
        () => new GeminiProvider(this.supabase, modelName as GeminiModelName)
      );
    }
    
    // Register Volcengine models
    this.providerFactories.set(
      DEFAULT_VOLCENGINE_IMAGE_MODEL,
      () => new VolcengineProvider(DEFAULT_VOLCENGINE_IMAGE_MODEL)
    );
  }
  
  /**
   * Get provider for a specific model name
   * @param modelName - The model name to get provider for
   * @returns ImageProvider instance
   * @throws ProviderError if model is not supported
   */
  getProvider(modelName: string): ImageProvider {
    const factory = this.providerFactories.get(modelName);
    
    if (!factory) {
      throw new ProviderError(
        `Unsupported model: ${modelName}`,
        'MODEL_NOT_SUPPORTED'
      );
    }
    
    return factory();
  }
  
  /**
   * Check if a model is supported
   * @param modelName - The model name to check
   * @returns true if the model is supported
   */
  isSupported(modelName: string): boolean {
    return this.providerFactories.has(modelName);
  }
  
  /**
   * Get the default provider (Volcengine)
   * @returns Default ImageProvider instance
   */
  getDefaultProvider(): ImageProvider {
    return new VolcengineProvider(DEFAULT_VOLCENGINE_IMAGE_MODEL);
  }
  
  /**
   * Get list of all supported model names
   * @returns Array of supported model names
   */
  getSupportedModels(): string[] {
    return Array.from(this.providerFactories.keys());
  }
  
  /**
   * Get provider for model, falling back to default if not specified
   * @param modelName - Optional model name
   * @returns ImageProvider instance
   */
  getProviderOrDefault(modelName?: string): ImageProvider {
    if (!modelName) {
      return this.getDefaultProvider();
    }
    
    if (this.isSupported(modelName)) {
      return this.getProvider(modelName);
    }
    
    // Fall back to default for unknown models
    console.warn(`[ProviderFactory] Unknown model "${modelName}", using default provider`);
    return this.getDefaultProvider();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a model is a Gemini model
 * Re-exported for convenience
 */
export { isGeminiModel, isVolcengineModel };

/**
 * Get the provider type for a model name
 * @param modelName - The model name to check
 * @returns 'gemini' | 'volcengine' | 'unknown'
 */
export function getProviderType(modelName: string): 'gemini' | 'volcengine' | 'unknown' {
  if (isGeminiModel(modelName)) {
    return 'gemini';
  }
  if (isVolcengineModel(modelName)) {
    return 'volcengine';
  }
  return 'unknown';
}
