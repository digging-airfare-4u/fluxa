import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('vercel deploy ignore contract', () => {
  const vercelIgnorePath = resolve(process.cwd(), '.vercelignore');
  const gitIgnorePath = resolve(process.cwd(), '.gitignore');

  it('keeps bulky local-only directories out of Vercel uploads', () => {
    expect(existsSync(vercelIgnorePath)).toBe(true);

    const content = readFileSync(vercelIgnorePath, 'utf8');

    expect(content).toContain('node_modules');
    expect(content).toContain('node_modules.broken');
    expect(content).toContain('.next');
    expect(content).toContain('.claude');
    expect(content).toContain('.codex');
    expect(content).toContain('.cursor');
    expect(content).toContain('tests');
    expect(content).toContain('docs');
  });

  it('matches git ignore for the extra broken dependency cache', () => {
    const content = readFileSync(gitIgnorePath, 'utf8');

    expect(content).toContain('node_modules.broken');
    expect(content).toContain('docs');
  });
});
