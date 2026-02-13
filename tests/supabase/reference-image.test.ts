/**
 * Feature: reference-image-preprocessing
 * Property 1: Prefer original bytes under compression threshold
 * Validates: Requirements 2.1, 2.3
 */

import { describe, it, expect } from 'vitest';
import { fetchReferenceImageForGemini } from '../../supabase/functions/_shared/utils/reference-image.ts';

function buildBinaryResponse(sizeBytes: number, mimeType = 'image/png'): Response {
  return new Response(new Uint8Array(sizeBytes), {
    status: 200,
    headers: { 'content-type': mimeType },
  });
}

describe('fetchReferenceImageForGemini', () => {
  it('returns original image when below threshold', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push(url);
      return buildBinaryResponse(128 * 1024, 'image/png');
    };

    const result = await fetchReferenceImageForGemini(
      'https://example.com/sample.png',
      {
        compressThresholdBytes: 512 * 1024,
        fetcher,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.strategy).toBe('original');
    expect(result?.sizeBytes).toBe(128 * 1024);
    expect(calls).toEqual(['https://example.com/sample.png']);
  });

  it('uses COS compressed variant when source is above threshold and compressed is smaller', async () => {
    const calls: string[] = [];
    const cosUrl = 'https://bucket.cos.ap-tokyo.myqcloud.com/path/to/original.png';

    const fetcher: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push(url);

      if (url === cosUrl) {
        return buildBinaryResponse(3 * 1024 * 1024, 'image/png');
      }

      if (url.includes('imageMogr2/thumbnail')) {
        return buildBinaryResponse(480 * 1024, 'image/jpeg');
      }

      return new Response('not found', { status: 404 });
    };

    const result = await fetchReferenceImageForGemini(cosUrl, {
      compressThresholdBytes: 2 * 1024 * 1024,
      fetcher,
    });

    expect(result).not.toBeNull();
    expect(result?.strategy).toBe('cos-compressed');
    expect(result?.sizeBytes).toBe(480 * 1024);
    expect(result?.mimeType).toBe('image/jpeg');
    expect(calls[0]).toBe(cosUrl);
    expect(calls.some((url) => url.includes('imageMogr2/thumbnail'))).toBe(true);
  });

  it('keeps original when source is non-COS even if above threshold', async () => {
    const calls: string[] = [];
    const url = 'https://cdn.example.com/large-reference.png';

    const fetcher: typeof fetch = async (input) => {
      const requestUrl = typeof input === 'string' ? input : input.url;
      calls.push(requestUrl);
      return buildBinaryResponse(4 * 1024 * 1024, 'image/png');
    };

    const result = await fetchReferenceImageForGemini(url, {
      compressThresholdBytes: 2 * 1024 * 1024,
      fetcher,
    });

    expect(result).not.toBeNull();
    expect(result?.strategy).toBe('original');
    expect(calls).toEqual([url]);
  });

  it('keeps original when compressed candidate is not smaller', async () => {
    const calls: string[] = [];
    const cosUrl = 'https://bucket.cos.ap-tokyo.myqcloud.com/path/to/original.png';

    const fetcher: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push(url);

      if (url === cosUrl) {
        return buildBinaryResponse(3 * 1024 * 1024, 'image/png');
      }

      if (url.includes('imageMogr2/thumbnail')) {
        return buildBinaryResponse(3 * 1024 * 1024, 'image/jpeg');
      }

      return new Response('not found', { status: 404 });
    };

    const result = await fetchReferenceImageForGemini(cosUrl, {
      compressThresholdBytes: 2 * 1024 * 1024,
      fetcher,
    });

    expect(result).not.toBeNull();
    expect(result?.strategy).toBe('original');
    expect(result?.sizeBytes).toBe(3 * 1024 * 1024);
    expect(calls.some((url) => url.includes('imageMogr2/thumbnail'))).toBe(true);
  });
});
