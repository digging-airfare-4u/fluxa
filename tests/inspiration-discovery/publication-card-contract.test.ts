import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('opens discover detail in-place instead of linking to a route', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain('const IMAGE_RATIO_CLASSES');
    expect(source).toContain('function getImageRatioClass(publicationId: string)');
    expect(source).toContain('getImageRatioClass(publication.id)');
    expect(source).toContain('onOpenDetail?: (publicationId: string) => void');
    expect(source).toContain('onClick={() => onOpenDetail?.(publication.id)}');
    expect(source).toContain('type="button"');
    expect(source).toContain('line-clamp-2');
    expect(source).toContain('publication.display_name');
    expect(source).toContain('publication.like_count');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('aria-label={`${publication.like_count} likes`}');
    expect(source).toContain('footerActions');
    expect(source).not.toContain('href={`/app/discover/${publication.id}`}');
    expect(source).not.toContain("router.push(`/app/discover/${publication.id}`)");
    expect(source).not.toContain('<Link');
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
    expect(source).toContain('disabled={!!isRemixing}');
    expect(source).toContain("t('discover.remix_cta')");
    expect(source).toContain("t('actions.loading')");
    expect(discoverPage).toContain('entry: "card"');
  });
});
