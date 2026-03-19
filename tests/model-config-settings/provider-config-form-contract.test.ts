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
});
