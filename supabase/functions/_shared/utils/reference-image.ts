/**
 * Reference image preprocessing for Gemini image-to-image requests.
 * Attempts CDN-side compression for COS-hosted images before inline upload.
 */

export interface GeminiReferenceImage {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  sizeBytes: number;
  sourceUrl: string;
  strategy: 'original' | 'cos-compressed';
}

export interface FetchReferenceImageOptions {
  compressThresholdBytes?: number;
  fetcher?: typeof fetch;
}

const DEFAULT_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2MB

const COS_TRANSFORMS = [
  'imageMogr2/thumbnail/2048x2048>/quality/82/format/webp/strip',
  'imageMogr2/thumbnail/2048x2048>/quality/82/format/jpg/strip',
] as const;

interface ImageFetchResult {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  sizeBytes: number;
}

function normalizeMimeType(raw: string | null): string {
  if (!raw) return 'image/png';
  const normalized = raw.split(';')[0]?.trim();
  return normalized || 'image/png';
}

function isCosUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('.cos.') && parsed.hostname.endsWith('.myqcloud.com');
  } catch {
    return false;
  }
}

function buildCosCompressedUrls(originalUrl: string): string[] {
  try {
    const parsed = new URL(originalUrl);
    const existingQuery = parsed.search ? parsed.search.slice(1) : '';

    return COS_TRANSFORMS.map((transform) => {
      parsed.search = existingQuery ? `${transform}&${existingQuery}` : transform;
      return parsed.toString();
    });
  } catch {
    return [];
  }
}

async function fetchImageBytes(url: string, fetcher: typeof fetch): Promise<ImageFetchResult | null> {
  try {
    const response = await fetcher(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = normalizeMimeType(response.headers.get('content-type'));

    return {
      arrayBuffer,
      mimeType,
      sizeBytes: arrayBuffer.byteLength,
    };
  } catch {
    return null;
  }
}

export async function fetchReferenceImageForGemini(
  imageUrl: string,
  options: FetchReferenceImageOptions = {}
): Promise<GeminiReferenceImage | null> {
  const fetcher = options.fetcher ?? fetch;
  const compressThresholdBytes = options.compressThresholdBytes ?? DEFAULT_COMPRESS_THRESHOLD_BYTES;

  const original = await fetchImageBytes(imageUrl, fetcher);
  if (!original) return null;

  const originalResult: GeminiReferenceImage = {
    ...original,
    sourceUrl: imageUrl,
    strategy: 'original',
  };

  if (original.sizeBytes <= compressThresholdBytes) {
    return originalResult;
  }

  if (!isCosUrl(imageUrl)) {
    return originalResult;
  }

  let best = originalResult;
  const candidates = buildCosCompressedUrls(imageUrl);

  for (const candidateUrl of candidates) {
    const candidate = await fetchImageBytes(candidateUrl, fetcher);
    if (!candidate) continue;

    if (candidate.sizeBytes < best.sizeBytes) {
      best = {
        ...candidate,
        sourceUrl: candidateUrl,
        strategy: 'cos-compressed',
      };
    }

    if (best.sizeBytes <= compressThresholdBytes) {
      break;
    }
  }

  return best;
}

