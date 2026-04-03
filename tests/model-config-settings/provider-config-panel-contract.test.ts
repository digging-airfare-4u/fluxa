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
    expect(source).toContain("t('providers.anthropic_compatible.title')");
    expect(source).toContain("t('providers.anthropic_compatible.section_manage_desc')");
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

  it('renders a model defaults section for super-admins', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/ProviderConfigPanel.tsx'),
      'utf8',
    );

    expect(source).toContain("useTranslations('providerConfig')");
    expect(source).toContain('fetchModelDefaults');
    expect(source).toContain('updateModelDefaults');
    expect(source).toContain("t('defaults.title')");
    expect(source).toContain('default_chat_model');
    expect(source).toContain('default_image_model');
    expect(source).toContain('agent_default_brain_model');
    expect(source).not.toContain('updateAgentDefaultBrain');
  });
});
