/**
 * Gemini JSON Helpers
 * Lightweight REST helpers for provider-native Gemini JSON calls.
 */

import { ProviderError } from '../errors/index.ts';

export interface GeminiJsonCallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];

  return parts
    .map((part) => (typeof (part as Record<string, unknown>).text === 'string'
      ? (part as Record<string, unknown>).text
      : ''))
    .join('\n')
    .trim();
}

function parseJsonPayload<T>(content: string): T {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || content.match(/\{[\s\S]*\}/)?.[0] || content;
  return JSON.parse(candidate) as T;
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

export async function callGeminiJson<T>(
  options: GeminiJsonCallOptions,
): Promise<T> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new ProviderError(
      'GEMINI_API_KEY not configured',
      'CONFIG_ERROR',
      undefined,
      'gemini',
      options.model,
      500,
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${options.systemPrompt}\n\n${options.userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ProviderError(
      `Gemini request failed: ${errorText || response.statusText}`,
      'API_ERROR',
      undefined,
      'gemini',
      options.model,
      response.status,
    );
  }

  const data = await response.json() as Record<string, unknown>;
  const content = extractTextFromGeminiResponse(data);
  if (!content) {
    throw new ProviderError(
      'Gemini returned an empty response',
      'EMPTY_RESPONSE',
      data,
      'gemini',
      options.model,
      502,
    );
  }

  try {
    return parseJsonPayload<T>(content);
  } catch (error) {
    throw new ProviderError(
      `Failed to parse Gemini JSON response: ${error instanceof Error ? error.message : 'unknown error'}`,
      'PARSE_ERROR',
      { content },
      'gemini',
      options.model,
      502,
    );
  }
}
