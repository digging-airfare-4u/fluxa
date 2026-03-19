import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('provider config panel contract', () => {
  it('renders a dedicated anthropic-compatible section for agent brain only configs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigPanel.tsx'),
      'utf8',
    );

    expect(source).toContain("const anthropicCompatibleConfigs = configs.filter((c) => c.provider === 'anthropic-compatible')");
    expect(source).toContain('title="Anthropic-Compatible"');
    expect(source).toContain('Agent Brain 专用');
    expect(source).toContain("provider: 'anthropic-compatible'");
  });

  it('passes provider through panel-level connection tests', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('provider: ProviderType;');
    expect(source).toContain('return testProviderConnection(params);');
  });

  it('writes the hidden agent default brain when saving anthropic-compatible configs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('updateAgentDefaultBrain');
    expect(source).toContain("savedConfig.provider === 'anthropic-compatible'");
    expect(source).toContain('model: savedConfig.model_identifier');
  });
});
