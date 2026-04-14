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

interface RetryWithExponentialBackoffOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  provider?: string;
  model?: string;
  diagnosticContext?: Record<string, unknown>;
}

const RETRYABLE_PROVIDER_STATUSES = [408, 429, 500, 502, 503, 504, 529];
const BUSY_PROVIDER_STATUSES = [429, 503, 529];

function readDiagnosticString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readDiagnosticNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractRequestIdFromText(value: string): string | undefined {
  const match = value.match(/request\s*id\s*[:=]\s*([a-zA-Z0-9._-]+)/i);
  return match?.[1];
}

function extractRequestIdFromJson(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directRequestId = readDiagnosticString(record.requestId) ?? readDiagnosticString(record.request_id);
  if (directRequestId) {
    return directRequestId;
  }

  return extractRequestIdFromJson(record.error);
}

function extractProviderStatus(error: unknown): number | undefined {
  if (!(error instanceof ProviderError)) {
    return undefined;
  }

  if (typeof error.httpStatus === 'number') {
    return error.httpStatus;
  }

  const details = error.details;
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  return readDiagnosticNumber((details as Record<string, unknown>).status);
}

function extractProviderRequestId(error: unknown): string | undefined {
  if (!(error instanceof ProviderError)) {
    return undefined;
  }

  const details = error.details;
  if (details && typeof details === 'object') {
    const requestId = extractRequestIdFromJson(details);
    if (requestId) {
      return requestId;
    }

    const body = (details as Record<string, unknown>).body;
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        const parsedRequestId = extractRequestIdFromJson(parsed);
        if (parsedRequestId) {
          return parsedRequestId;
        }
      } catch {
        // Ignore invalid JSON bodies and fall back to regex extraction.
      }

      const requestIdFromBody = extractRequestIdFromText(body);
      if (requestIdFromBody) {
        return requestIdFromBody;
      }
    }
  }

  return extractRequestIdFromText(error.message);
}

function extractProviderBody(error: ProviderError): string | undefined {
  const details = error.details;
  if (!details || typeof details !== 'object') {
    return undefined;
  }

  return readDiagnosticString((details as Record<string, unknown>).body);
}

function isBusyProviderError(error: unknown): error is ProviderError {
  if (!(error instanceof ProviderError)) {
    return false;
  }

  if (error.httpStatus !== undefined && BUSY_PROVIDER_STATUSES.includes(error.httpStatus)) {
    return true;
  }

  const body = extractProviderBody(error);
  const haystack = `${error.message}\n${body ?? ''}`.toLowerCase();
  return haystack.includes('overloaded_error');
}

function rewriteBusyProviderError(error: ProviderError, maxAttempts: number): ProviderError {
  const details = error.details && typeof error.details === 'object'
    ? { ...(error.details as Record<string, unknown>) }
    : {};

  details.retry_attempts = maxAttempts;

  const requestId = extractProviderRequestId(error);
  if (requestId && !details.request_id) {
    details.request_id = requestId;
  }

  if (!details.original_provider_code && error.providerCode) {
    details.original_provider_code = error.providerCode;
  }

  return new ProviderError(
    'Model service is temporarily busy. Please try again in a moment.',
    'MODEL_BUSY',
    details,
    error.providerName,
    error.modelName,
    503,
  );
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

export function isStructuredOutputFallbackEligible(error: unknown): boolean {
  return error instanceof ProviderError
    && (error.providerCode === 'PARSE_ERROR' || error.providerCode === 'EMPTY_RESPONSE');
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ProviderError)) {
    return true;
  }

  return error.httpStatus !== undefined && RETRYABLE_PROVIDER_STATUSES.includes(error.httpStatus);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function supportsJsonResponseFormat(provider: ChatProvider): boolean {
  return provider.name === 'openai' || provider.name.startsWith('user-configured:openai-compatible');
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryWithExponentialBackoffOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let delayMs = options?.initialDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const diagnosticContext = options?.diagnosticContext ?? {};
      console.error('[chat-provider-json] provider call failed', {
        stage: readDiagnosticString(diagnosticContext.stage),
        conversationId: readDiagnosticString(diagnosticContext.conversationId),
        historyLength: readDiagnosticNumber(diagnosticContext.historyLength),
        attempt,
        maxAttempts,
        provider: options?.provider ?? (error instanceof ProviderError ? error.providerName : undefined),
        model: options?.model ?? (error instanceof ProviderError ? error.modelName : undefined),
        requestId: extractProviderRequestId(error),
        status: extractProviderStatus(error),
      });
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        break;
      }

      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  if (lastError instanceof ProviderError && isBusyProviderError(lastError)) {
    throw rewriteBusyProviderError(lastError, maxAttempts);
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
