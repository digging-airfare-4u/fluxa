import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover feed card layout contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );

  it('keeps discover as the denser browsing feed without changing query flow', () => {
    expect(source).toMatch(/const\s+DISCOVER_SKELETON_HEIGHTS\s*=\s*\[[^\]]*'h-48'[^\]]*'h-64'[^\]]*'h-56'[^\]]*'h-72'[^\]]*\]\s+as\s+const/);
    expect(source).toContain('DISCOVER_SKELETON_HEIGHTS[i % DISCOVER_SKELETON_HEIGHTS.length]');
    expect(source).toContain('columns-2');
    expect(source).toContain('sm:columns-3');
    expect(source).toContain('md:columns-4');
    expect(source).toContain('xl:columns-5');
    expect(source).toContain('gap-3');
    expect(source).toContain('sm:gap-4');
    expect(source).toContain('pt-2');
    expect(source).toContain('<PublicationCard key={pub.id} publication={pub} />');
    expect(source).toContain('fetchGalleryPublications');
  });
});
