import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover feed card layout contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );

  it('turns discover into a content-first inspiration feed while preserving query flow', () => {
    expect(source).toContain("const DISCOVER_SKELETON_HEIGHTS = ['h-[24rem]', 'h-[16rem]', 'h-[22rem]', 'h-[28rem]'] as const;");
    expect(source).toContain('const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(paramSearch));');
    expect(source).toContain('max-w-[1280px]');
    expect(source).toContain("{t('discover.browse_subtitle')}");
    expect(source).toContain('columns-2 lg:columns-3 xl:columns-4 gap-5');
    expect(source).toContain('DISCOVER_SKELETON_HEIGHTS[index%DISCOVER_SKELETON_HEIGHTS.length]');
    expect(source).toContain('overflow-x-auto pb-1');
    expect(source).toContain('flex min-w-max items-center gap-5 text-sm');
    expect(source).toContain('setIsSearchExpanded((current) => !current);');
    expect(source).toContain('handleSortChange');
    expect(source).toContain('ResponsiveMasonry');
    expect(source).toContain('<PublicationCard');
    expect(source).toContain('layout="discover"');
    expect(source).toContain('fetchGalleryPublications');
  });
});
