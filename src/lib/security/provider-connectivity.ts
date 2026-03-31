/**
 * Provider Connectivity Validation
 * Shared connectivity checks for provider test and save-time revalidation.
 * Requirements: 4.9, 4.12, 4.13
 */

import type { ProviderType } from '@/lib/api/provider-configs';

export interface ProviderConnectivityResult {
  success: boolean;
  message?: string;
}

export interface ProviderConnectivityWithTimeoutResult extends ProviderConnectivityResult {
  timedOut?: boolean;
}

export interface TestProviderConnectivityParams {
  provider: ProviderType;
  apiUrl: string;
  apiKey: string;
  modelName: string;
}

export interface TestProviderConnectivityWithTimeoutParams extends TestProviderConnectivityParams {
  timeoutMs: number;
}

const MODELS_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 15_000;

export async function testProviderConnectivity(
  params: TestProviderConnectivityParams,
): Promise<ProviderConnectivityResult> {
  const baseUrl = params.apiUrl.replace(/\/+$/, '');

  if (params.provider === 'anthropic-compatible') {
    return tryAnthropicMessages(baseUrl, params.apiKey, params.modelName);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiKey}`,
    'Content-Type': 'application/json',
  };

  const modelsResult = await tryListModels(`${baseUrl}/models`, headers);
  if (modelsResult.success) return { success: true };

  const v1ModelsResult = await tryListModels(`${baseUrl}/v1/models`, headers);
  if (v1ModelsResult.success) return { success: true };

  const chatResult = await tryChatCompletion(baseUrl, headers, params.modelName);
  if (chatResult.success) return { success: true };

  if (isMiniMaxHost(baseUrl)) {
    const miniMaxImageResult = await tryMiniMaxImageGeneration(baseUrl, headers, params.modelName);
    if (miniMaxImageResult.success) return { success: true };

    return {
      success: false,
      message:
        miniMaxImageResult.message ||
        chatResult.message ||
        modelsResult.message ||
        'Provider connectivity test failed',
    };
  }

  return {
    success: false,
    message: chatResult.message || modelsResult.message || 'Provider connectivity test failed',
  };
}

function isMiniMaxHost(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === 'api.minimaxi.com' || hostname === 'api.minimax.io';
  } catch {
    return false;
  }
}

function resolveMiniMaxImageUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/v1')) {
    return `${baseUrl}/image_generation`;
  }
  return `${baseUrl}/v1/image_generation`;
}

export async function testProviderConnectivityWithTimeout(
  params: TestProviderConnectivityWithTimeoutParams,
): Promise<ProviderConnectivityWithTimeoutResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<ProviderConnectivityResult>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({
          success: false,
          message: `Validation timeout after ${params.timeoutMs}ms`,
        });
      }, params.timeoutMs);
    });

    const result = await Promise.race([
      testProviderConnectivity(params),
      timeoutPromise,
    ]);

    if (!result.success && result.message?.includes('Validation timeout')) {
      return { ...result, timedOut: true };
    }
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function tryListModels(
  url: string,
  headers: Record<string, string>,
): Promise<ProviderConnectivityResult> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 404) {
      return { success: false, message: 'Models endpoint not found' };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: `Authentication failed (${response.status})` };
    }

    return { success: false, message: `Models endpoint returned ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { success: false, message: `Failed to reach models endpoint: ${message}` };
  }
}

async function tryChatCompletion(
  baseUrl: string,
  headers: Record<string, string>,
  modelName: string,
): Promise<ProviderConnectivityResult> {
  const paths = ['/chat/completions', '/v1/chat/completions'];

  for (const path of paths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      });

      if (response.ok) {
        return { success: true };
      }

      if (response.status === 401 || response.status === 403) {
        return { success: false, message: `Authentication failed (${response.status})` };
      }

      if (response.status === 404) {
        continue;
      }

      try {
        const errorBody = await response.json();
        const message =
          errorBody?.error?.message ||
          errorBody?.message ||
          `Status ${response.status}`;
        return { success: false, message: `Chat completion failed: ${message}` };
      } catch {
        return { success: false, message: `Chat completion returned ${response.status}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      if (path === paths[paths.length - 1]) {
        return { success: false, message: `Failed to reach chat endpoint: ${message}` };
      }
    }
  }

  return { success: false, message: 'No compatible endpoint found' };
}

async function tryMiniMaxImageGeneration(
  baseUrl: string,
  headers: Record<string, string>,
  modelName: string,
): Promise<ProviderConnectivityResult> {
  try {
    const response = await fetch(resolveMiniMaxImageUrl(baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        prompt: 'test',
        aspect_ratio: '1:1',
        n: 1,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: `Authentication failed (${response.status})` };
    }

    try {
      const errorBody = await response.json();
      const message =
        errorBody?.base_resp?.status_msg ||
        errorBody?.error?.message ||
        errorBody?.message ||
        `Status ${response.status}`;
      return { success: false, message: `MiniMax image generation failed: ${message}` };
    } catch {
      return { success: false, message: `MiniMax image generation returned ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { success: false, message: `Failed to reach MiniMax image endpoint: ${message}` };
  }
}

async function tryAnthropicMessages(
  baseUrl: string,
  apiKey: string,
  modelName: string,
): Promise<ProviderConnectivityResult> {
  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: `Authentication failed (${response.status})` };
    }

    try {
      const errorBody = await response.json();
      const message =
        errorBody?.error?.message ||
        errorBody?.message ||
        `Status ${response.status}`;
      return { success: false, message: `Anthropic messages failed: ${message}` };
    } catch {
      return { success: false, message: `Anthropic messages returned ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { success: false, message: `Failed to reach messages endpoint: ${message}` };
  }
}
