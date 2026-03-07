/**
 * Provider Connectivity Validation
 * Shared connectivity checks for provider test and save-time revalidation.
 * Requirements: 4.9, 4.12, 4.13
 */

export interface ProviderConnectivityResult {
  success: boolean;
  message?: string;
}

export interface ProviderConnectivityWithTimeoutResult extends ProviderConnectivityResult {
  timedOut?: boolean;
}

const MODELS_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 15_000;

/**
 * Test provider connectivity using:
 * 1) GET /models
 * 2) GET /v1/models
 * 3) POST /chat/completions and /v1/chat/completions fallback
 *
 * Never calls image-generation endpoints.
 */
export async function testProviderConnectivity(
  apiUrl: string,
  apiKey: string,
  modelName: string,
): Promise<ProviderConnectivityResult> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const modelsResult = await tryListModels(`${baseUrl}/models`, headers);
  if (modelsResult.success) return { success: true };

  const v1ModelsResult = await tryListModels(`${baseUrl}/v1/models`, headers);
  if (v1ModelsResult.success) return { success: true };

  const chatResult = await tryChatCompletion(baseUrl, headers, modelName);
  if (chatResult.success) return { success: true };

  return {
    success: false,
    message: chatResult.message || modelsResult.message || 'Provider connectivity test failed',
  };
}

/**
 * Save-time final revalidation wrapper with fail-fast timeout.
 */
export async function testProviderConnectivityWithTimeout(
  apiUrl: string,
  apiKey: string,
  modelName: string,
  timeoutMs: number,
): Promise<ProviderConnectivityWithTimeoutResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<ProviderConnectivityResult>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({
          success: false,
          message: `Validation timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });

    const result = await Promise.race([
      testProviderConnectivity(apiUrl, apiKey, modelName),
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
