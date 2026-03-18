import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent default brain contract', () => {
  it('hydrates the hidden agent brain from system settings when a shared default is configured', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('getAgentDefaultBrainModel');
    expect(source).toContain('configuredAgentDefaultModel');
    expect(source).toContain('setSelectedAgentModel(configuredAgentDefaultModel)');
    expect(source).toContain("model.type === 'ops'");
  });
});
