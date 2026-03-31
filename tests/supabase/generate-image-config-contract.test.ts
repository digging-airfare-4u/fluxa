import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('generate-image edge config contract', () => {
  it('disables gateway JWT verification so the function can validate forwarded auth headers itself', () => {
    const configPath = resolve(process.cwd(), 'supabase/functions/generate-image/config.toml');

    expect(existsSync(configPath)).toBe(true);
    expect(readFileSync(configPath, 'utf8')).toContain('verify_jwt = false');
  });
});
