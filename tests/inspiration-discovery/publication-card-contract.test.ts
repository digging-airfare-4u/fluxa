import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('uses the lightweight feed card contract', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain('const IMAGE_RATIO_CLASSES');
    expect(source).toContain('function getImageRatioClass(publicationId: string)');
    expect(source).toContain('getImageRatioClass(publication.id)');
    expect(source).toContain('publication.title');
    expect(source).toContain('publication.cover_image_url');
    expect(source).toContain('line-clamp-2');
    expect(source).toContain('publication.display_name');
    expect(source).toContain('publication.like_count');
    expect(source).not.toContain('LikeButton');
    expect(source).not.toContain('BookmarkButton');
    expect(source).not.toContain('publication.view_count');
    expect(source).toContain('footerActions');
    expect(source).toContain('href={`/app/discover/${publication.id}`}');
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
