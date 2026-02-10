/**
 * Provider Registry
 * Centralized registry mapping model names to provider instances.
 * Uses lazy factory functions so providers are only instantiated when needed.
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { ProviderError } from '../errors/index.ts';
import type { ChatProvider } from './chat-types.ts';
import type { ImageProvider } from './types.ts';

// ============================================================================
// ProviderRegistry
// ============================================================================

/**
 * Central registry for chat and image providers.
 * Maps model names to lazy factory functions that create provider instances on demand.
 */
export class ProviderRegistry {
  private readonly chatProviders = new Map<string, () => ChatProvider>();
  private readonly imageProviders = new Map<string, () => ImageProvider>();

  /**
   * Register a chat model with a lazy factory function.
   * @param modelName - Display model name used as lookup key
   * @param factory - Factory function that creates the ChatProvider instance
   */
  registerChatModel(modelName: string, factory: () => ChatProvider): void {
    this.chatProviders.set(modelName, factory);
  }

  /**
   * Register an image model with a lazy factory function.
   * @param modelName - Display model name used as lookup key
   * @param factory - Factory function that creates the ImageProvider instance
   */
  registerImageModel(modelName: string, factory: () => ImageProvider): void {
    this.imageProviders.set(modelName, factory);
  }

  /**
   * Get a chat provider instance for the given model name.
   * @param modelName - The model name to look up
   * @returns ChatProvider instance created by the registered factory
   * @throws ProviderError with MODEL_NOT_SUPPORTED if model is not registered
   */
  getChatProvider(modelName: string): ChatProvider {
    const factory = this.chatProviders.get(modelName);
    if (!factory) {
      throw new ProviderError(
        `Chat model not supported: ${modelName}`,
        'MODEL_NOT_SUPPORTED',
        { modelName },
        undefined,
        modelName
      );
    }
    return factory();
  }

  /**
   * Get an image provider instance for the given model name.
   * @param modelName - The model name to look up
   * @returns ImageProvider instance created by the registered factory
   * @throws ProviderError with MODEL_NOT_SUPPORTED if model is not registered
   */
  getImageProvider(modelName: string): ImageProvider {
    const factory = this.imageProviders.get(modelName);
    if (!factory) {
      throw new ProviderError(
        `Image model not supported: ${modelName}`,
        'MODEL_NOT_SUPPORTED',
        { modelName },
        undefined,
        modelName
      );
    }
    return factory();
  }

  /**
   * Check if a model name is registered (chat or image).
   * @param modelName - The model name to check
   * @returns true if the model is registered in either chat or image providers
   */
  isSupported(modelName: string): boolean {
    return this.chatProviders.has(modelName) || this.imageProviders.has(modelName);
  }

  /**
   * Get all registered model names grouped by type.
   * @returns Object with chat and image model name arrays
   */
  getSupportedModels(): { chat: string[]; image: string[] } {
    return {
      chat: Array.from(this.chatProviders.keys()),
      image: Array.from(this.imageProviders.keys()),
    };
  }
}
