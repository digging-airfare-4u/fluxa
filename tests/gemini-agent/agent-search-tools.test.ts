import { describe, expect, it, vi } from 'vitest';
import {
  extractImageCandidatesFromHtml,
  fetchVerifiedPageContent,
  parseDuckDuckGoWebResults,
  searchImages,
} from '../../supabase/functions/_shared/utils/agent-search.ts';

describe('parseDuckDuckGoWebResults', () => {
  it('parses structured candidate results with title, url, and domain', () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle">Example Article</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://another.example.org/post">Another Result</a>
      </div>
    `;

    const results = parseDuckDuckGoWebResults(html);

    expect(results).toEqual([
      {
        title: 'Example Article',
        url: 'https://example.com/article',
        domain: 'example.com',
        verified: false,
      },
      {
        title: 'Another Result',
        url: 'https://another.example.org/post',
        domain: 'another.example.org',
        verified: false,
      },
    ]);
  });
});

describe('fetchVerifiedPageContent', () => {
  it('fetches page content and returns a verified citation candidate', async () => {
    const fetcher: typeof fetch = vi.fn(async () => new Response(`
      <html>
        <head><title>Verified Source</title></head>
        <body>
          <article><h1>Heading</h1><p>Important factual content.</p></article>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));

    const result = await fetchVerifiedPageContent('https://example.com/source', { fetcher });

    expect(result.title).toBe('Verified Source');
    expect(result.url).toBe('https://example.com/source');
    expect(result.domain).toBe('example.com');
    expect(result.verified).toBe(true);
    expect(result.content).toContain('Important factual content.');
  });
});

describe('extractImageCandidatesFromHtml', () => {
  it('extracts og:image candidates with source-page references', () => {
    const html = `
      <html>
        <head>
          <title>Gallery Page</title>
          <meta property="og:image" content="https://cdn.example.com/image.jpg" />
        </head>
      </html>
    `;

    const results = extractImageCandidatesFromHtml(html, 'https://example.com/gallery');

    expect(results).toEqual([
      {
        imageUrl: 'https://cdn.example.com/image.jpg',
        sourcePageUrl: 'https://example.com/gallery',
        sourcePageTitle: 'Gallery Page',
        verified: false,
      },
    ]);
  });
});

describe('searchImages', () => {
  it('derives image candidates from fetched source pages', async () => {
    const fetcher: typeof fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.startsWith('https://html.duckduckgo.com/html/')) {
        return new Response(`
          <div class="result">
            <a class="result__a" href="https://example.com/gallery">Gallery</a>
          </div>
        `, { status: 200, headers: { 'content-type': 'text/html' } });
      }

      return new Response(`
        <html>
          <head>
            <title>Gallery</title>
            <meta property="og:image" content="https://cdn.example.com/gallery.jpg" />
          </head>
        </html>
      `, { status: 200, headers: { 'content-type': 'text/html' } });
    });

    const results = await searchImages('minimal poster', { fetcher, maxPages: 1 });

    expect(results).toEqual([
      {
        imageUrl: 'https://cdn.example.com/gallery.jpg',
        sourcePageUrl: 'https://example.com/gallery',
        sourcePageTitle: 'Gallery',
        verified: false,
      },
    ]);
  });
});
