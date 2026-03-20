/**
 * Provider Registry Setup
 * Instantiates a ProviderRegistry and registers all current models.
 * Uses lazy factories so API keys are only read when a provider is actually used.
 * Requirements: 3.1, 3.6, 9.3
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ProviderRegistry } from './registry.ts';
import { OpenAIChatProvider } from './openai-chat-provider.ts';
import { AnthropicChatAdapter } from './anthropic-chat-adapter.ts';
import { VolcengineChatProvider } from './volcengine-chat-provider.ts';
import { GeminiProvider } from './gemini.ts';
import type { GeminiModelName } from './types.ts';
import { VolcengineProvider } from './volcengine.ts';
import { DEFAULT_CHAT_MODEL, DEFAULT_VOLCENGINE_IMAGE_MODEL } from '../defaults.ts';

/**
 * Create a fully configured ProviderRegistry with all current models registered.
 * @param supabase - Supabase client instance (needed by GeminiProvider for system_settings)
 * @returns ProviderRegistry with all models registered
 */
export function createRegistry(supabase: SupabaseClient): ProviderRegistry {
  const registry = new ProviderRegistry();

  // --- Chat providers (OpenAI) ---
  const openaiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
  for (const model of openaiModels) {
    registry.registerChatModel(model, () => new OpenAIChatProvider(model));
  }

  // --- Chat providers (Anthropic) ---
  const anthropicModels = ['claude-3-haiku', 'claude-3-sonnet'];
  for (const model of anthropicModels) {
    registry.registerChatModel(model, () => new AnthropicChatAdapter(model));
  }

  // --- Chat providers (Volcengine) ---
  registry.registerChatModel(
    DEFAULT_CHAT_MODEL,
    () => new VolcengineChatProvider(DEFAULT_CHAT_MODEL)
  );

  // --- Image providers (Gemini) ---
  // Mode is resolved internally by GeminiProvider.resolveMode() (defaults to 'native')
  const geminiImageModels: GeminiModelName[] = [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
  ];
  for (const model of geminiImageModels) {
    registry.registerImageModel(
      model,
      () => new GeminiProvider({ supabase, modelName: model })
    );
  }

  // --- Image providers (Volcengine) ---
  registry.registerImageModel(
    DEFAULT_VOLCENGINE_IMAGE_MODEL,
    () => new VolcengineProvider(DEFAULT_VOLCENGINE_IMAGE_MODEL)
  );

  return registry;
}
