import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('opens discover detail in-place instead of linking to a route', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain("layout?: 'default' | 'compact' | 'discover' | 'home';");
    expect(source).toContain('onOpenDetail?: (publicationId: string) => void');
    expect(source).toContain('onClick={() => onOpenDetail?.(publication.id)}');
    expect(source).toContain('type="button"');
    expect(source).toContain("resolvedLayout === 'discover'");
    expect(source).toContain('publication.view_count');
    expect(source).toContain('publication.like_count');
    expect(source).toContain('publication.display_name');
    expect(source).toContain('publication.canvas_width');
    expect(source).toContain('publication.canvas_height');
    expect(source).toContain('getDiscoverCoverImageUrl');
    expect(source).toContain('const coverImageSrc = getDiscoverCoverImageUrl(publication.cover_image_url, resolvedLayout);');
    expect(source).toContain('coverAspectRatio');
    expect(source).toContain("style={{ aspectRatio: coverAspectRatio }}");
    expect(source).toContain('formatCompactStat');
    expect(source).toContain('className="sr-only">{publication.title}</span>');
    expect(source).toContain('rounded-[22px]');
    expect(source).toContain('Eye');
    expect(source).toContain('Heart');
    expect(source).toContain('footerActions');
    expect(source).not.toContain('href={`/app/discover/${publication.id}`}');
    expect(source).not.toContain("router.push(`/app/discover/${publication.id}`)");
    expect(source).not.toContain('<Link');
  });

  it('supports a lighter home preview layout while preserving source aspect ratios', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain("resolvedLayout === 'home'");
    expect(source).toContain('max-h-[22rem]');
    expect(source).toContain('min-h-[12rem]');
    expect(source).toContain("isHome ? 'text-sm' : 'text-[1.0625rem]'");
    expect(source).toContain("isHome ? 'gap-2 text-[11px]' : 'gap-3 text-xs'");
    expect(source).toContain('style={{ aspectRatio: coverAspectRatio }}');
  });

  it('supports remix action loading contract', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );
    const discoverPage = readFileSync(
      resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
      'utf8'
    );

    expect(source).toContain('onRemix?:');
    expect(source).toContain('isRemixing?: boolean');
    expect(source).toContain('disabled={Boolean(isRemixing)}');
    expect(source).toContain("t('discover.remix_cta')");
    expect(source).toContain("t('actions.loading')");
    expect(discoverPage).toContain('entry: "card"');
  });
});
