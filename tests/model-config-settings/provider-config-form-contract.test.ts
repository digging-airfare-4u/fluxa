import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('provider config form contract', () => {
  it('keeps anthropic-compatible configs chat-only in the form UI', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigForm.tsx'),
      'utf8',
    );

    expect(source).toContain("const isAnthropicCompatible = provider === 'anthropic-compatible'");
    expect(source).toContain("const resolvedModelType = isAnthropicCompatible ? 'chat' : modelType");
    expect(source).toContain('{!isAnthropicCompatible && (');
  });

  it('exposes a standalone connectivity test action without forcing save', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigForm.tsx'),
      'utf8',
    );

    expect(source).toContain('const handleTestOnly = useCallback(async () => {');
    expect(source).toContain('测试连接');
  });
});
