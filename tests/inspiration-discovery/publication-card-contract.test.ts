import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('contains required gallery fields', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain('publication.title');
    expect(source).toContain('publication.cover_image_url');
    expect(source).toContain('publication.view_count');
    expect(source).toContain('publication.like_count');
    expect(source).toContain('href={`/app/discover/${publication.id}`}');
  });
});
