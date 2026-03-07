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
});
