/**
 * Image URL utilities
 * Handles image URL transformations for CORS proxy and discover cover thumbnails.
 */

const IMAGE_PROXY_PATH = '/api/image-proxy';
const DISCOVER_COVER_TRANSFORMS = {
  default: 'imageMogr2/thumbnail/960x>/quality/78/format/webp/strip',
  compact: 'imageMogr2/thumbnail/800x>/quality/76/format/webp/strip',
  discover: 'imageMogr2/thumbnail/1280x>/quality/80/format/webp/strip',
  home: 'imageMogr2/thumbnail/960x>/quality/78/format/webp/strip',
} as const;

export type DiscoverCoverVariant = keyof typeof DISCOVER_COVER_TRANSFORMS;

function hasCosTransform(url: URL): boolean {
  const query = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  return query.includes('imageMogr2/');
}

function buildCosTransformUrl(url: string, transform: string): string {
  try {
    const parsed = new URL(url);
    if (!isCosUrl(url) || hasCosTransform(parsed)) {
      return url;
    }

    const existingQuery = parsed.search ? parsed.search.slice(1) : '';
    parsed.search = existingQuery ? `${transform}&${existingQuery}` : transform;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Convert image URL to use the image proxy if needed
 * This bypasses CORS issues when loading images in canvas/fabric
 */
export function getProxyImageUrl(url: string): string {
  if (!url) return url;

  // Only proxy COS images (other images should work directly)
  if (!url.includes('.cos.') || url.startsWith('data:')) {
    return url;
  }

  // Use base64 encoding to avoid URL parameter parsing issues with signed URLs
  // that contain & and ? characters
  const encodedUrl = btoa(url);
  return `${IMAGE_PROXY_PATH}?u=${encodedUrl}`;
}

/**
 * Check if URL is a COS (Tencent Cloud) URL
 */
export function isCosUrl(url: string): boolean {
  return url.includes('.cos.') && !url.startsWith('data:');
}

/**
 * Build a lighter-weight cover URL for discover/home cards.
 * Leaves non-COS hosts untouched so older external sources keep rendering.
 */
export function getDiscoverCoverImageUrl(
  url: string,
  variant: DiscoverCoverVariant = 'default',
): string {
  if (!url) return url;
  return buildCosTransformUrl(url, DISCOVER_COVER_TRANSFORMS[variant]);
}
