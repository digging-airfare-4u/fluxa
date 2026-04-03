import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('profile feed visual language contract', () => {
  const profileSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/profile/page.tsx'),
    'utf8'
  );
  const userProfileSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/user/[userId]/page.tsx'),
    'utf8'
  );
  const detailContentSource = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationDetailContent.tsx'),
    'utf8'
  );

  it('uses discover-style masonry on profile publications and bookmarks', () => {
    expect(profileSource).toContain('columns-1 md:columns-2 xl:columns-3 gap-6');
    expect(profileSource).toContain('layout="discover"');
    expect(profileSource).toContain('mt-4');
  });

  it('uses discover-style masonry on creator profile works', () => {
    expect(userProfileSource).toContain('columns-1 md:columns-2 xl:columns-3 gap-6');
    expect(userProfileSource).toContain('layout="discover"');
  });

  it('uses discover-style cards for related works inside the publication detail dialog', () => {
    expect(detailContentSource).toContain('layout="discover"');
    expect(detailContentSource).toContain('columns-1 md:columns-2 gap-5');
    expect(detailContentSource).toContain("t('discover.related_works')");
  });
});
