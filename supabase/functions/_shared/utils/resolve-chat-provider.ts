/**
 * Resolve a system or BYOK chat provider for text/agent runtime use.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ProviderError, UserProviderConfigInvalidError } from '../errors/index.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import type { ChatProvider } from '../providers/chat-types.ts';
import { AnthropicCompatibleClient } from '../providers/anthropic-compatible-client.ts';
import { OpenAICompatibleClient } from '../providers/openai-client.ts';
import { UserConfiguredChatProvider } from '../providers/user-configured-chat-provider.ts';
import { UserProviderService } from '../services/user-provider.ts';
import { isModelConfigEnabled } from '../observability/feature-flags.ts';
import { validateProviderHostAsync } from '../security/provider-host-allowlist.ts';

const USER_MODEL_PREFIX = 'user:';

export interface ResolveChatProviderOptions {
  serviceClient: SupabaseClient;
  registry: ProviderRegistry;
  userId: string;
  selectedModel?: string;
  fallbackModel: string;
}

export interface ResolvedChatProvider {
  selectedModel: string;
  displayName: string;
  provider: ChatProvider;
  isByok: boolean;
}

function isUserModelIdentifier(model: string): model is `user:${string}` {
  return model.startsWith(USER_MODEL_PREFIX);
}

function getUserConfigId(model: `user:${string}`): string {
  return model.slice(USER_MODEL_PREFIX.length);
}

async function getSystemModelDisplayName(
  serviceClient: SupabaseClient,
  modelName: string,
): Promise<string> {
  const { data } = await serviceClient
    .from('ai_models')
    .select('display_name')
    .eq('name', modelName)
    .maybeSingle();

  return data?.display_name || modelName;
}

export async function resolveChatProvider(
  options: ResolveChatProviderOptions,
): Promise<ResolvedChatProvider> {
  const selectedModel = options.selectedModel || options.fallbackModel;

  if (!isUserModelIdentifier(selectedModel)) {
    return {
      selectedModel,
      displayName: await getSystemModelDisplayName(options.serviceClient, selectedModel),
      provider: options.registry.getChatProvider(selectedModel),
      isByok: false,
    };
  }

  const enabled = await isModelConfigEnabled(options.serviceClient);
  if (!enabled) {
    throw new ProviderError(
      'Custom provider configuration is currently disabled. Please try again later.',
      'FEATURE_DISABLED',
      undefined,
      'user-configured',
      selectedModel,
      503,
    );
  }

  const encryptionSecret = Deno.env.get('PROVIDER_ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new ProviderError(
      'Server configuration error: encryption secret not available',
      'CONFIG_ERROR',
      undefined,
      'user-configured',
      selectedModel,
      500,
    );
  }

  const userProviderService = new UserProviderService(options.serviceClient, encryptionSecret);
  const config = await userProviderService.getConfigById(
    options.userId,
    getUserConfigId(selectedModel),
    'chat',
  );

  if (!config) {
    throw new UserProviderConfigInvalidError(
      'The selected chat provider config is unavailable, disabled, or not configured for chat.',
      { model: selectedModel },
    );
  }

  const hostValidation = await validateProviderHostAsync(config.api_url, {
    serviceClient: options.serviceClient,
  });
  if (!hostValidation.valid) {
    throw new UserProviderConfigInvalidError(
      hostValidation.reason,
      { model: selectedModel, source: hostValidation.source },
    );
  }

  const client = config.provider === 'anthropic-compatible'
    ? new AnthropicCompatibleClient({
      apiUrl: config.api_url,
      apiKey: config.api_key,
      providerName: `user-configured:${config.provider}`,
    })
    : new OpenAICompatibleClient({
      apiUrl: config.api_url,
      apiKey: config.api_key,
      providerName: `user-configured:${config.provider}`,
    });

  const provider = new UserConfiguredChatProvider(
    client,
    config,
  );

  return {
    selectedModel,
    displayName: config.display_name,
    provider,
    isByok: true,
  };
}
