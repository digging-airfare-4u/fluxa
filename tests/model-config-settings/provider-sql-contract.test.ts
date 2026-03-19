/**
 * Feature: model-config-settings
 * Anthropic-compatible provider SQL contract
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('anthropic-compatible provider SQL contract', () => {
  it('extends the provider constraint in the canonical SQL and migration', () => {
    const snapshotPath = resolve(process.cwd(), 'supabase/user-provider-configs.sql');
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260319153000_add_anthropic_compatible_provider.sql',
    );

    expect(existsSync(snapshotPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const snapshotSql = existsSync(snapshotPath) ? readFileSync(snapshotPath, 'utf8') : '';
    const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    expect(snapshotSql).toContain(
      "provider IN ('volcengine', 'openai-compatible', 'anthropic-compatible')",
    );
    expect(migrationSql).toContain(
      'DROP CONSTRAINT IF EXISTS user_provider_configs_provider_check',
    );
    expect(migrationSql).toContain('ADD CONSTRAINT user_provider_configs_provider_check');
    expect(migrationSql).toContain(
      "provider IN ('volcengine', 'openai-compatible', 'anthropic-compatible')",
    );
  });
});
