import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  callChatProviderJson,
  isStructuredOutputFallbackEligible,
  retryWithExponentialBackoff,
} from '../../supabase/functions/_shared/utils/chat-provider-json.ts';
import { ProviderError } from '../../supabase/functions/_shared/errors/index.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('callChatProviderJson', () => {
  it('emits flattened retry diagnostics for agent provider failures', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const providerError = new ProviderError(
      'Provider API error: 500 - upstream failed',
      'API_ERROR',
      {
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'The service encountered an unexpected internal error. Request id: req_12345',
          },
        }),
      },
      'user-configured:minimax',
      'MiniMax M2.5',
      500,
    );

    await expect(retryWithExponentialBackoff(
      async () => {
        throw providerError;
      },
      {
        maxAttempts: 1,
        initialDelayMs: 0,
        provider: 'user-configured:minimax',
        model: 'MiniMax M2.5',
        diagnosticContext: {
          stage: 'planner',
          conversationId: 'conv-123',
          historyLength: 7,
        },
      },
    )).rejects.toBe(providerError);

    expect(logSpy).toHaveBeenCalledWith(
      '[chat-provider-json] provider call failed',
      expect.objectContaining({
        stage: 'planner',
        conversationId: 'conv-123',
        historyLength: 7,
        attempt: 1,
        provider: 'user-configured:minimax',
        model: 'MiniMax M2.5',
        requestId: 'req_12345',
        status: 500,
      }),
    );
  });

  it('parses the final JSON object when a reasoning model prefixes <think> content', async () => {
    const provider = {
      name: 'user-configured:openai-compatible',
      chatCompletion: vi.fn(async () => ({
        content: `<think>
The user wants me to respond with a specific JSON object: {"ok":true,"vendor":"minimax"}

I should only return that JSON object and nothing else.
</think>

{"ok":true,"vendor":"minimax"}`,
      })),
    };

    const result = await callChatProviderJson<{ ok: boolean; vendor: string }>({
      provider,
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toEqual({
      ok: true,
      vendor: 'minimax',
    });
    expect(provider.chatCompletion).toHaveBeenCalledWith(
      [{ role: 'user', content: 'test' }],
      expect.objectContaining({
        responseFormat: { type: 'json_object' },
      }),
    );
  });

  it('keeps parsing fenced json responses', async () => {
    const provider = {
      name: 'openai',
      chatCompletion: vi.fn(async () => ({
        content: '```json\n{"ok":true}\n```',
      })),
    };

    const result = await callChatProviderJson<{ ok: boolean }>({
      provider,
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result).toEqual({ ok: true });
  });

  it('retries overloaded 529 provider failures and rewrites the final error into a busy message', async () => {
    let attempts = 0;

    await expect(retryWithExponentialBackoff(
      async () => {
        attempts += 1;
        throw new ProviderError(
          'Anthropic-compatible API error: 529 - {"type":"error","error":{"type":"overloaded_error","message":"overloaded_error (529)"},"request_id":"req_529"}',
          'API_ERROR',
          {
            status: 529,
            body: JSON.stringify({
              type: 'error',
              error: {
                type: 'overloaded_error',
                message: 'overloaded_error (529)',
              },
              request_id: 'req_529',
            }),
          },
          'user-configured:anthropic-compatible',
          'MiniMax Brain',
          529,
        );
      },
      {
        maxAttempts: 3,
        initialDelayMs: 0,
        provider: 'user-configured:anthropic-compatible',
        model: 'MiniMax Brain',
        diagnosticContext: {
          stage: 'planner',
          conversationId: 'conv-overload',
          historyLength: 2,
        },
      },
    )).rejects.toMatchObject({
      message: 'Model service is temporarily busy. Please try again in a moment.',
      providerCode: 'MODEL_BUSY',
      providerName: 'user-configured:anthropic-compatible',
      modelName: 'MiniMax Brain',
      httpStatus: 503,
    });

    expect(attempts).toBe(3);
  });

  it('only marks parse-style structured output failures as fallback eligible', () => {
    const parseError = new ProviderError(
      'Failed to parse chat provider JSON response: Unexpected token',
      'PARSE_ERROR',
      { content: 'hello there' },
      'user-configured:anthropic-compatible',
      'MiniMax Brain',
      502,
    );
    const overloadedError = new ProviderError(
      'Anthropic-compatible API error: 529 - overloaded_error (529)',
      'API_ERROR',
      {
        status: 529,
        body: '{"type":"error","error":{"type":"overloaded_error","message":"overloaded_error (529)"},"request_id":"req_529"}',
      },
      'user-configured:anthropic-compatible',
      'MiniMax Brain',
      529,
    );

    expect(isStructuredOutputFallbackEligible(parseError)).toBe(true);
    expect(isStructuredOutputFallbackEligible(overloadedError)).toBe(false);
  });
});
