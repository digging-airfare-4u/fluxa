import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shared provider runtime contract', () => {
  it('allows edge runtime to resolve configs owned by super admins', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/services/user-provider.ts'),
      'utf8',
    );

    expect(source).toContain("data.user_id !== userId");
    expect(source).toContain(".from('user_profiles')");
    expect(source).toContain(".select('is_super_admin')");
    expect(source).toContain('ownerProfile?.is_super_admin !== true');
  });
});
