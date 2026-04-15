import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover detail route removal contract', () => {
  it('removes direct discover detail pushes from profile actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8');
    expect(source).not.toContain("router.push(`/app/discover/${pub.id}`)");
  });
});
