/**
 * Feature: model-config-settings
 * Anthropic-compatible runtime contract
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('anthropic-compatible runtime contract', () => {
  it('branches user chat provider resolution for anthropic-compatible configs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/utils/resolve-chat-provider.ts'),
      'utf8',
    );

    expect(source).toContain("config.provider === 'anthropic-compatible'");
    expect(source).toContain('AnthropicCompatibleClient');
  });

  it('keeps user-configured runtime wrapper generic instead of OpenAI-only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/providers/user-configured-chat-provider.ts'),
      'utf8',
    );

    expect(source).not.toContain('private readonly client: OpenAICompatibleClient');
    expect(source).toContain('interface UserConfiguredChatClient');
    expect(source).toContain('chatCompletion(model: string, messages: ChatMessage[], options?: ChatCompletionOptions)');
  });
});
