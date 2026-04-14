import { describe, expect, it } from 'vitest';
import { getDiscoverCoverImageUrl } from '@/lib/utils/image-url';

describe('image url helpers', () => {
  it('builds COS-compressed discover cover urls for home cards', () => {
    const result = getDiscoverCoverImageUrl(
      'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/foo/bar/image.jpg',
      'home',
    );
    const parsed = new URL(result);

    expect(parsed.origin + parsed.pathname).toBe('https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/foo/bar/image.jpg');
    expect(decodeURIComponent(parsed.search.slice(1))).toContain('imageMogr2/thumbnail/880x>/quality/76/format/webp/strip');
  });

  it('preserves existing query strings when appending COS transforms', () => {
    const result = getDiscoverCoverImageUrl(
      'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/foo/bar/image.jpg?foo=bar',
      'discover',
    );
    const parsed = new URL(result);

    expect(decodeURIComponent(parsed.search.slice(1))).toContain('imageMogr2/thumbnail/1280x>/quality/80/format/webp/strip');
    expect(parsed.search).toContain('&foo=bar');
  });

  it('does not transform non-COS urls', () => {
    const url = 'https://img.nanobananas.ai/nano-banana/gallery/txt2img/txt2img-1.webp';
    expect(getDiscoverCoverImageUrl(url, 'home')).toBe(url);
  });

  it('does not double-append image transforms to already optimized COS urls', () => {
    const url = 'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/foo/bar/image.jpg?imageMogr2/thumbnail/880x>/quality/76/format/webp/strip';
    expect(getDiscoverCoverImageUrl(url, 'home')).toBe(url);
  });
});
