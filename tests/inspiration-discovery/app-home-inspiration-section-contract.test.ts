import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('app home inspiration section contract', () => {
  const file = resolve(process.cwd(), 'src/app/app/page.tsx');
  const content = readFileSync(file, 'utf-8');

  it('loads latest discover publications with bounded preview size', () => {
    expect(content).toContain('fetchGalleryPublications');
    expect(content).toContain('fetchCategories');
    expect(content).toContain("sortBy: 'latest'");
    expect(content).toContain('const HOME_INSPIRATION_PAGE_SIZE = 12;');
    expect(content).toContain('limit: HOME_INSPIRATION_PAGE_SIZE');
  });

  it('renders inspiration section after recent projects while keeping the home hero intact', () => {
    expect(content).toContain('HomeInput');
    expect(content).toContain('dashboard.recent_projects');
    expect(content).toContain('discover.title');
    expect(content).toContain('inspirationItems');
    expect(content.indexOf("tCommon('discover.title')")).toBeGreaterThan(content.indexOf("t('dashboard.recent_projects')"));
  });

  it('reuses discover publication card and discover navigation', () => {
    expect(content).toContain('<PublicationCard');
    expect(content).toContain('ResponsiveMasonry');
    expect(content).toContain('layout="discover"');
    expect(content).toContain('onOpenDetail={handleOpenPublication}');
    expect(content).toContain("router.push('/app/discover')");
  });

  it('includes non-blocking loading and degraded states', () => {
    expect(content).toContain('isInspirationLoading');
    expect(content).toContain('inspirationError');
    expect(content).toContain('hasMoreInspiration');
    expect(content).toContain('isFetchingMoreInspiration');
  });

  it('uses the discover-style editorial preview rhythm for the inspiration section', () => {
    expect(content).toContain("const HOME_INSPIRATION_SKELETON_HEIGHTS = ['h-[24rem]', 'h-[16rem]', 'h-[22rem]', 'h-[28rem]'] as const;");
    expect(content).toContain('max-w-[1280px]');
    expect(content).toContain('overflow-x-auto pb-1');
    expect(content).toContain('columns-2 lg:columns-3 xl:columns-4 gap-5');
    expect(content).toContain('HOME_INSPIRATION_SKELETON_HEIGHTS[i % HOME_INSPIRATION_SKELETON_HEIGHTS.length]');
    expect(content).toContain('handleOpenDiscover');
    expect(content).toContain("tCommon('discover.all_categories')");
  });

  it('continues loading more inspiration items when the bottom sentinel enters the viewport', () => {
    expect(content).toContain('const inspirationSentinelRef = useRef<HTMLDivElement>(null);');
    expect(content).toContain('const loadMoreInspiration = useCallback(() => {');
    expect(content).toContain('const shouldShowInspirationPagination = inspirationItems.length > 0 && (hasMoreInspiration || isFetchingMoreInspiration);');
    expect(content).toContain('cursorPublishedAt: cursor?.publishedAt');
    expect(content).toContain('cursorId: cursor?.id');
    expect(content).toContain('new IntersectionObserver');
    expect(content).toContain("rootMargin: '240px'");
    expect(content).toContain('if (entries[0].isIntersecting) {');
    expect(content).toContain('loadMoreInspiration();');
    expect(content).toContain('ref={inspirationSentinelRef}');
    expect(content).toContain('onClick={loadMoreInspiration}');
    expect(content).toContain("tCommon('discover.load_more')");
  });
});
