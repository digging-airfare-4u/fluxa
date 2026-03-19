/**
 * Provider Module Exports
 * Barrel export for all provider-related modules.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.1, 7.3
 */

// ============================================================================
// Image Provider Types
// ============================================================================

export type {
  ImageProvider,
  ImageResult,
  ProviderRequest,
  ProviderCapabilities,
  ValidationResult,
  AspectRatio,
  ResolutionPreset,
  GeminiModelName,
  VolcengineModelName,
} from './types.ts';

export {
  GEMINI_MODELS,
  VOLCENGINE_MODELS,
  RESOLUTION_PRESETS,
  SUPPORTED_ASPECT_RATIOS,
  isGeminiModel,
  isVolcengineModel,
} from './types.ts';

// ============================================================================
// Chat Types
// ============================================================================

export type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatProvider,
  ProviderConfig,
  ModelConfig,
} from './chat-types.ts';

// ============================================================================
// OpenAI-Compatible Client
// ============================================================================

export { OpenAICompatibleClient } from './openai-client.ts';
export { AnthropicCompatibleClient } from './anthropic-compatible-client.ts';
export type {
  OpenAIClientConfig,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './openai-client.ts';
export type { AnthropicCompatibleClientConfig } from './anthropic-compatible-client.ts';

// ============================================================================
// Chat Providers
// ============================================================================

export { OpenAIChatProvider } from './openai-chat-provider.ts';
export { AnthropicChatAdapter } from './anthropic-chat-adapter.ts';
export { VolcengineChatProvider } from './volcengine-chat-provider.ts';

// ============================================================================
// Image Providers
// ============================================================================

export { GeminiProvider, calculateDimensions, getResolutionPointsMultiplier, calculateGeminiPointsCost } from './gemini.ts';
export type { GeminiApiMode, GeminiProviderConfig } from './gemini.ts';
export { VolcengineProvider } from './volcengine.ts';

// ============================================================================
// Config Validator
// ============================================================================

export { validateProviderConfig } from './config-validator.ts';
export type { ValidationSuccess, ValidationFailure, ConfigValidationResult } from './config-validator.ts';

// ============================================================================
// Registry
// ============================================================================

export { ProviderRegistry } from './registry.ts';
export { createRegistry } from './registry-setup.ts';

// ============================================================================
// Factory (legacy, kept for compatibility)
// ============================================================================

export { ProviderFactory, getProviderType } from './factory.ts';
