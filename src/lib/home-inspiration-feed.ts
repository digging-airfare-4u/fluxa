/**
 * Home inspiration feed utilities.
 *
 * Keeps the newest item first while biasing the remaining preview cards toward
 * portrait/landscape alternation so the home feed feels more intentionally mixed.
 */

import type { GalleryPublication } from '@/lib/supabase/queries/publications';

type HomeFeedOrientation = 'portrait' | 'landscape' | 'neutral';

const LANDSCAPE_RATIO_THRESHOLD = 1.08;
const PORTRAIT_RATIO_THRESHOLD = 0.92;

function resolveHomeFeedOrientation(publication: GalleryPublication): HomeFeedOrientation {
  const width = publication.canvas_width;
  const height = publication.canvas_height;

  if (!width || !height) return 'neutral';

  const ratio = width / height;

  if (ratio >= LANDSCAPE_RATIO_THRESHOLD) return 'landscape';
  if (ratio <= PORTRAIT_RATIO_THRESHOLD) return 'portrait';

  return 'neutral';
}

export function buildHomeMixedOrientationFeed(publications: GalleryPublication[]): GalleryPublication[] {
  if (publications.length <= 2) return publications;

  const orientations = publications.map(resolveHomeFeedOrientation);
  const hasPortrait = orientations.includes('portrait');
  const hasLandscape = orientations.includes('landscape');

  if (!hasPortrait || !hasLandscape) return publications;

  const result: GalleryPublication[] = [publications[0]];
  const remaining = publications.slice(1).map((publication) => ({
    publication,
    orientation: resolveHomeFeedOrientation(publication),
  }));

  let lastStrongOrientation = resolveHomeFeedOrientation(publications[0]);

  if (lastStrongOrientation === 'neutral') {
    const firstStrongIndex = remaining.findIndex((entry) => entry.orientation !== 'neutral');
    if (firstStrongIndex === -1) return publications;

    const [firstStrongEntry] = remaining.splice(firstStrongIndex, 1);
    result.push(firstStrongEntry.publication);
    lastStrongOrientation = firstStrongEntry.orientation;
  }

  while (remaining.length > 0) {
    const preferredOrientation = lastStrongOrientation === 'portrait' ? 'landscape' : 'portrait';
    const preferredIndex = remaining.findIndex((entry) => entry.orientation === preferredOrientation);
    const nextIndex = preferredIndex >= 0 ? preferredIndex : 0;
    const [nextEntry] = remaining.splice(nextIndex, 1);

    result.push(nextEntry.publication);

    if (nextEntry.orientation !== 'neutral') {
      lastStrongOrientation = nextEntry.orientation;
    }
  }

  return result;
}
