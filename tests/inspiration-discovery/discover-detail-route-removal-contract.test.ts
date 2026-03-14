import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover detail route removal contract', () => {
  it('removes the standalone discover detail page', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/app/discover/[id]/page.tsx'))).toBe(false);
  });

  it('removes direct discover detail pushes from profile actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8');
    expect(source).not.toContain("router.push(`/app/discover/${pub.id}`)");
  });
});
