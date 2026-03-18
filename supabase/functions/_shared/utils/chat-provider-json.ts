/**
 * Chat Provider JSON Helpers
 * Shared JSON parsing + retry wrapper for provider-backed planner/executor flows.
 */

import { ProviderError } from '../errors/index.ts';
import type { ChatMessage, ChatProvider } from '../providers/chat-types.ts';

export interface ChatProviderJsonCallOptions {
  provider: ChatProvider;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

function stripThinkBlocks(content: string): string {
  return content.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
}

function extractBalancedJsonObjects(content: string): string[] {
  const results: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
        inString = false;
        isEscaped = false;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        results.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return results;
}

function parseJsonPayload<T>(content: string): T {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
  const strippedContent = stripThinkBlocks(content);
  const candidates = [
    fencedMatch?.[1]?.trim(),
    strippedContent,
    ...extractBalancedJsonObjects(strippedContent).reverse(),
    ...extractBalancedJsonObjects(content).reverse(),
    content.trim(),
  ].filter((candidate): candidate is string => Boolean(candidate));

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to parse JSON payload');
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ProviderError)) {
    return true;
  }

  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return error.httpStatus !== undefined && retryableStatuses.includes(error.httpStatus);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function supportsJsonResponseFormat(provider: ChatProvider): boolean {
  return provider.name === 'openai' || provider.name.startsWith('user-configured:openai-compatible');
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let delayMs = options?.initialDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        break;
      }

      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw lastError;
}

export async function callChatProviderJson<T>(
  options: ChatProviderJsonCallOptions,
): Promise<T> {
  const result = await options.provider.chatCompletion(
    options.messages,
    {
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 4000,
      responseFormat: supportsJsonResponseFormat(options.provider)
        ? { type: 'json_object' }
        : undefined,
    },
  );

  if (!result.content?.trim()) {
    throw new ProviderError(
      'Chat provider returned an empty response',
      'EMPTY_RESPONSE',
      undefined,
      options.provider.name,
      undefined,
      502,
    );
  }

  try {
    return parseJsonPayload<T>(result.content);
  } catch (error) {
    throw new ProviderError(
      `Failed to parse chat provider JSON response: ${error instanceof Error ? error.message : 'unknown error'}`,
      'PARSE_ERROR',
      { content: result.content },
      options.provider.name,
      undefined,
      502,
    );
  }
}
