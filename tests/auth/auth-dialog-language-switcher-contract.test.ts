import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('auth dialog language switcher contract', () => {
  it('renders the shared language switcher in the auth dialog header', () => {
    const authDialog = readFileSync(
      resolve(process.cwd(), 'src/components/auth/AuthDialog.tsx'),
      'utf8',
    );

    expect(authDialog).toContain("import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';");
    expect(authDialog).toContain('<LanguageSwitcher />');
  });
});
