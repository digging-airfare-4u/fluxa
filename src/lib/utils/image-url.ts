/**
 * Image URL utilities
 * Handles image URL transformations for CORS proxy
 */

const IMAGE_PROXY_PATH = '/api/image-proxy';

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
