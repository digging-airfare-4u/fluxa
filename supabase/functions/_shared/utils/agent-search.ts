/**
 * Agent Search Utilities
 * Provides lightweight web search parsing, controlled page fetching, image
 * candidate extraction, and external image download validation.
 */

export interface WebSearchCandidate {
  title: string;
  url: string;
  domain: string;
  verified: false;
}

export interface VerifiedPageContent {
  title: string;
  url: string;
  domain: string;
  content: string;
  verified: true;
}

export interface ImageSearchCandidate {
  imageUrl: string;
  sourcePageUrl: string;
  sourcePageTitle: string;
  verified: false;
}

export interface DownloadedExternalImage {
  imageData: ArrayBuffer;
  contentType: string;
  sizeBytes: number;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeDuckDuckGoHref(href: string): string | null {
  const decodedHref = decodeHtml(href.trim());

  if (decodedHref.startsWith('//duckduckgo.com/l/?')) {
    const url = new URL(`https:${decodedHref}`);
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : null;
  }

  if (decodedHref.startsWith('/l/?')) {
    const url = new URL(`https://duckduckgo.com${decodedHref}`);
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : null;
  }

  if (/^https?:\/\//i.test(decodedHref)) {
    return decodedHref;
  }

  return null;
}

export function parseDuckDuckGoWebResults(
  html: string,
  options?: { maxResults?: number },
): WebSearchCandidate[] {
  const regex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const results: WebSearchCandidate[] = [];
  const seenUrls = new Set<string>();
  const maxResults = options?.maxResults ?? 8;

  for (const match of html.matchAll(regex)) {
    const rawUrl = match[1];
    const rawTitle = match[2];
    const normalizedUrl = normalizeDuckDuckGoHref(rawUrl);
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      continue;
    }

    const parsedUrl = new URL(normalizedUrl);
    const title = stripTags(rawTitle);
    if (!title) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    results.push({
      title,
      url: normalizedUrl,
      domain: parsedUrl.hostname,
      verified: false,
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripTags(titleMatch[1]) : 'Untitled';
}

function extractTextContent(html: string, maxChars: number): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = stripTags(withoutScripts);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

export async function searchWeb(
  query: string,
  options?: {
    fetcher?: typeof fetch;
    maxResults?: number;
  },
): Promise<WebSearchCandidate[]> {
  const fetcher = options?.fetcher ?? fetch;
  const response = await fetcher(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'FluxaAgent/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Web search failed with status ${response.status}`);
  }

  const html = await response.text();
  return parseDuckDuckGoWebResults(html, { maxResults: options?.maxResults });
}

export async function fetchVerifiedPageContent(
  url: string,
  options?: {
    fetcher?: typeof fetch;
    maxChars?: number;
  },
): Promise<VerifiedPageContent> {
  const fetcher = options?.fetcher ?? fetch;
  const response = await fetcher(url, {
    headers: {
      'User-Agent': 'FluxaAgent/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page content with status ${response.status}`);
  }

  const html = await response.text();
  const parsedUrl = new URL(url);

  return {
    title: extractTitle(html),
    url,
    domain: parsedUrl.hostname,
    content: extractTextContent(html, options?.maxChars ?? 4000),
    verified: true,
  };
}

export function extractImageCandidatesFromHtml(
  html: string,
  sourcePageUrl: string,
): ImageSearchCandidate[] {
  const matches = [
    ...html.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi),
    ...html.matchAll(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/gi),
  ];
  const title = extractTitle(html);
  const seenUrls = new Set<string>();
  const results: ImageSearchCandidate[] = [];

  for (const match of matches) {
    const imageUrl = decodeHtml(match[1]).trim();
    if (!/^https?:\/\//i.test(imageUrl) || seenUrls.has(imageUrl)) {
      continue;
    }

    seenUrls.add(imageUrl);
    results.push({
      imageUrl,
      sourcePageUrl,
      sourcePageTitle: title,
      verified: false,
    });
  }

  return results;
}

export async function searchImages(
  query: string,
  options?: {
    fetcher?: typeof fetch;
    maxPages?: number;
    maxResults?: number;
  },
): Promise<ImageSearchCandidate[]> {
  const fetcher = options?.fetcher ?? fetch;
  const webResults = await searchWeb(query, {
    fetcher,
    maxResults: options?.maxPages ?? 5,
  });

  const imageCandidates: ImageSearchCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const result of webResults) {
    const response = await fetcher(result.url, {
      headers: {
        'User-Agent': 'FluxaAgent/1.0',
      },
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    for (const candidate of extractImageCandidatesFromHtml(html, result.url)) {
      if (seenUrls.has(candidate.imageUrl)) {
        continue;
      }

      seenUrls.add(candidate.imageUrl);
      imageCandidates.push(candidate);
      if (imageCandidates.length >= (options?.maxResults ?? 8)) {
        return imageCandidates;
      }
    }
  }

  return imageCandidates;
}

export async function downloadExternalImage(
  imageUrl: string,
  options?: {
    fetcher?: typeof fetch;
    maxBytes?: number;
  },
): Promise<DownloadedExternalImage> {
  const fetcher = options?.fetcher ?? fetch;
  const response = await fetcher(imageUrl, {
    headers: {
      'User-Agent': 'FluxaAgent/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('External image URL did not return an image content-type');
  }

  const imageData = await response.arrayBuffer();
  const sizeBytes = imageData.byteLength;
  if (sizeBytes > (options?.maxBytes ?? 8 * 1024 * 1024)) {
    throw new Error('External image exceeded the maximum allowed size');
  }

  return {
    imageData,
    contentType,
    sizeBytes,
  };
}
