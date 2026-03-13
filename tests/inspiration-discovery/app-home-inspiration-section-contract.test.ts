import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('app home inspiration section contract', () => {
  const file = resolve(process.cwd(), 'src/app/app/page.tsx');
  const content = readFileSync(file, 'utf-8');

  it('loads latest discover publications with bounded preview size', () => {
    expect(content).toContain('fetchGalleryPublications');
    expect(content).toContain("sortBy: 'latest'");
    expect(content).toContain('limit: 6');
  });

  it('renders inspiration section after recent projects', () => {
    expect(content).toContain('dashboard.recent_projects');
    expect(content).toContain('discover.title');
    expect(content).toContain('inspirationItems');
  });

  it('reuses discover publication card and discover navigation', () => {
    expect(content).toContain('<PublicationCard');
    expect(content).toContain("router.push('/app/discover')");
  });

  it('includes non-blocking loading and degraded states', () => {
    expect(content).toContain('isInspirationLoading');
    expect(content).toContain('inspirationError');
  });

  it('uses a tighter preview masonry rhythm for the inspiration section', () => {
    expect(content).toContain("const HOME_INSPIRATION_SKELETON_HEIGHTS = ['h-44', 'h-56', 'h-48', 'h-64'] as const");
    expect(content).toContain('columns-2 lg:columns-3 gap-3 sm:gap-4');
    expect(content).toContain('HOME_INSPIRATION_SKELETON_HEIGHTS[i % HOME_INSPIRATION_SKELETON_HEIGHTS.length]');
    expect(content).toContain('<PublicationCard key={publication.id} publication={publication} />');
  });
});
