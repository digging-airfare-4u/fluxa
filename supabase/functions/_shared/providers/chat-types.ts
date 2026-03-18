/**
 * Unified Chat Provider Types
 * Defines the shared interfaces for OpenAI-compatible chat providers.
 * Requirements: 1.1, 3.1, 3.6
 */

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * OpenAI-format chat message
 */
export type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
}

// ============================================================================
// Chat Completion Types
// ============================================================================

/**
 * Options for chat completion requests
 */
export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
}

/**
 * Unified chat completion result
 */
export interface ChatCompletionResult {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Chat Provider Interface
// ============================================================================

/**
 * Abstract interface for chat completion providers.
 * All chat providers must implement this interface.
 * Requirements: 1.1
 */
export interface ChatProvider {
  readonly name: string;
  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Configuration for a provider connection.
 * Requirements: 3.1, 3.6
 */
export interface ProviderConfig {
  /** Provider identifier */
  name: string;
  /** Base API URL */
  apiUrl: string;
  /** Authentication type */
  authType: 'bearer' | 'api-key-header';
  /** Environment variable name for the API key */
  apiKeyEnvVar: string;
  /** Additional default headers */
  defaultHeaders?: Record<string, string>;
  /** API mode: 'openai' for OpenAI-compatible endpoints, 'native' for provider-native API */
  apiMode?: 'openai' | 'native';
}

/**
 * Configuration for a single model.
 * Requirements: 3.1
 */
export interface ModelConfig {
  /** Display model name (used as key in registry) */
  name: string;
  /** Provider-specific model ID sent in API requests */
  modelId: string;
  /** Provider this model belongs to */
  providerName: string;
  /** Model type */
  type: 'chat' | 'image';
}
