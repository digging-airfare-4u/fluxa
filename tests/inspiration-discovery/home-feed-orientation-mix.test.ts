import { describe, expect, it } from 'vitest';
import { buildHomeMixedOrientationFeed } from '@/lib/home-inspiration-feed';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

function createPublication(
  id: string,
  width: number | null,
  height: number | null,
): GalleryPublication {
  return {
    id,
    title: id,
    description: null,
    cover_image_url: `https://example.com/${id}.png`,
    category_slug: 'poster',
    category_name: 'Poster',
    tags: [],
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    bookmark_count: 0,
    published_at: '2026-04-06T00:00:00.000Z',
    user_id: 'user-1',
    display_name: 'Creator',
    avatar_url: null,
    canvas_width: width,
    canvas_height: height,
  };
}

describe('home inspiration feed orientation mix', () => {
  it('keeps the newest item first while alternating portrait and landscape cards whenever possible', () => {
    const publications = [
      createPublication('portrait-1', 900, 1400),
      createPublication('portrait-2', 900, 1400),
      createPublication('portrait-3', 900, 1400),
      createPublication('landscape-1', 1600, 900),
      createPublication('landscape-2', 1600, 900),
    ];

    const result = buildHomeMixedOrientationFeed(publications);

    expect(result.map((publication) => publication.id)).toEqual([
      'portrait-1',
      'landscape-1',
      'portrait-2',
      'landscape-2',
      'portrait-3',
    ]);
  });

  it('leaves the order unchanged when the preview set only contains one strong orientation', () => {
    const publications = [
      createPublication('portrait-1', 900, 1400),
      createPublication('portrait-2', 900, 1400),
      createPublication('portrait-3', 900, 1400),
    ];

    const result = buildHomeMixedOrientationFeed(publications);

    expect(result.map((publication) => publication.id)).toEqual([
      'portrait-1',
      'portrait-2',
      'portrait-3',
    ]);
  });
});
