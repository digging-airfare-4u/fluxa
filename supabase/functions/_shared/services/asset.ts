/**
 * Asset Service Module
 * Handles image upload, storage, and asset record management
 * Uses Tencent Cloud COS via native fetch (lightweight, no AWS SDK)
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { AssetError } from '../errors/index.ts';
import type { AssetRecord } from '../types/index.ts';

// Re-export types for convenience
export type { AssetRecord };

// Tencent Cloud COS configuration
const COS_BUCKET = Deno.env.get('COS_BUCKET') || 'fluxa-1390058464';
const COS_REGION = Deno.env.get('COS_REGION') || 'ap-tokyo';
const COS_PUBLIC_URL = `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;

/**
 * Asset metadata for generation tracking
 */
export interface AssetMetadata {
  model?: string;
  prompt?: string;
  resolution?: string;
  aspectRatio?: string;
  source?: {
    type: 'generate' | 'canvas_tool' | 'upload';
    origin?: string;
  };
  documentId?: string;
}

// ============================================================================
// COS Signing Utilities (V5 HMAC-SHA1)
// ============================================================================

/**
 * HMAC-SHA1 signing using Web Crypto API (available in Deno)
 */
async function hmacSha1(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

/**
 * SHA1 hash using Web Crypto API
 */
async function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return bufferToHex(hashBuffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate Tencent COS V5 Authorization header
 * Docs: https://cloud.tencent.com/document/product/436/7778
 */
async function generateCosAuth(
  method: string,
  path: string,
  headers: Record<string, string>,
  secretId: string,
  secretKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 600; // 10 min validity
  const keyTime = `${now};${expiry}`;

  // Step 1: SignKey = HMAC-SHA1(SecretKey, KeyTime)
  const signKeyBuf = await hmacSha1(secretKey, keyTime);
  const signKey = bufferToHex(signKeyBuf);

  // Step 2: Build sorted header list and HttpHeaders string for signing
  // Lowercase all header keys, sort alphabetically
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }
  const sortedHeaderKeys = Object.keys(lowerHeaders).sort();
  const headerList = sortedHeaderKeys.join(';');
  const httpHeaders = sortedHeaderKeys
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(lowerHeaders[k])}`)
    .join('&');

  // Step 3: Build HttpString
  // Format: method\npath\nqueryParams\nheaders\n
  const httpString = `${method.toLowerCase()}\n${path}\n\n${httpHeaders}\n`;

  // Step 4: StringToSign = sha1(HttpString)
  const httpStringHash = await sha1Hex(httpString);
  const stringToSign = `sha1\n${keyTime}\n${httpStringHash}\n`;

  // Step 5: Signature = HMAC-SHA1(SignKey, StringToSign)
  // SignKey is a hex string, used as-is (not decoded to binary)
  const signatureBuf = await hmacSha1(signKey, stringToSign);
  const signature = bufferToHex(signatureBuf);

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
}


/**
 * Generate a pre-signed URL for reading a COS object (GET)
 * Uses URL query parameter signing (no headers required for browser access)
 * Docs: https://cloud.tencent.com/document/product/436/7778
 * Valid for the specified duration (default 1 year)
 */
async function generatePresignedUrl(
  cosPath: string,
  secretId: string,
  secretKey: string,
  expirySeconds: number = 31536000 // 1 year
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + expirySeconds;
  const keyTime = `${now};${expiry}`;

  // SignKey = HMAC-SHA1(SecretKey, KeyTime)
  const signKeyBuf = await hmacSha1(secretKey, keyTime);
  const signKey = bufferToHex(signKeyBuf);

  // HttpString: get\npath\n\n\n (no query params, no headers for URL-based signing)
  const httpString = `get\n${cosPath}\n\n\n`;

  // StringToSign = sha1\nKeyTime\nSHA1(HttpString)\n
  const httpStringHash = await sha1Hex(httpString);
  const stringToSign = `sha1\n${keyTime}\n${httpStringHash}\n`;

  // Signature = HMAC-SHA1(SignKey, StringToSign)
  const signatureBuf = await hmacSha1(signKey, stringToSign);
  const signature = bufferToHex(signatureBuf);

  const host = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
  const params = `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=&q-url-param-list=&q-signature=${signature}`;

  return `https://${host}${cosPath}?${params}`;
}


// ============================================================================
// Asset Service
// ============================================================================

/**
 * Asset Service
 * Manages image uploads to Tencent Cloud COS and asset records in Supabase
 * Uses native fetch + COS V5 signing (no AWS SDK dependency)
 * Requirements: 5.1
 */
function getExtension(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'bin';
}

export class AssetService {
  constructor(
    private supabase: SupabaseClient,
    _supabaseUrl: string // Keep for backward compatibility
  ) {}

  private async uploadAsset(
    userId: string,
    projectId: string,
    imageData: ArrayBuffer,
    contentType: string,
    type: 'generate' | 'upload',
    metadata: AssetMetadata,
    filenamePrefix: 'generated' | 'upload'
  ): Promise<AssetRecord> {
    const assetId = crypto.randomUUID();
    const extension = getExtension(contentType);
    const storagePath = `${userId}/${projectId}/${assetId}.${extension}`;

    console.log(`[AssetService] ========== UPLOAD START ==========`);
    console.log(`[AssetService] Storage path: ${storagePath}`);
    console.log(`[AssetService] Image size: ${imageData.byteLength} bytes`);
    console.log(`[AssetService] Content type: ${contentType}`);
    console.log(`[AssetService] COS bucket: ${COS_BUCKET}`);
    console.log(`[AssetService] COS region: ${COS_REGION}`);
    console.log(`[AssetService] COS public URL base: ${COS_PUBLIC_URL}`);
    const uploadStart = Date.now();

    // Upload to COS via native fetch (lightweight, no SDK overhead)
    const secretId = Deno.env.get('COS_SECRET_ID');
    const secretKey = Deno.env.get('COS_SECRET_KEY');

    if (!secretId || !secretKey) {
      console.error(`[AssetService] COS credentials missing! SECRET_ID: ${!!secretId}, SECRET_KEY: ${!!secretKey}`);
      throw new AssetError('COS credentials not configured', 'CONFIG_ERROR');
    }
    console.log(`[AssetService] COS credentials loaded (SECRET_ID: ${secretId.slice(0, 6)}...)`);

    const cosPath = `/${storagePath}`;
    const uploadUrl = `${COS_PUBLIC_URL}${cosPath}`;
    console.log(`[AssetService] Upload URL: ${uploadUrl}`);

    // Headers to sign and send — include x-cos-acl for public read access
    const signedHeaders: Record<string, string> = {
      'content-type': contentType,
      'host': `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`,
      'x-cos-acl': 'public-read',
    };

    console.log(`[AssetService] Generating COS V5 authorization...`);
    const authStart = Date.now();
    const authorization = await generateCosAuth(
      'PUT', cosPath, signedHeaders, secretId, secretKey
    );
    console.log(`[AssetService] Authorization generated in ${Date.now() - authStart}ms`);
    console.log(`[AssetService] Authorization: ${authorization.slice(0, 80)}...`);

    console.log(`[AssetService] Sending PUT request to COS...`);
    const fetchStart = Date.now();
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Content-Length': String(imageData.byteLength),
        'Host': `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`,
        'x-cos-acl': 'public-read',
      },
      body: new Uint8Array(imageData),
    });
    console.log(`[AssetService] COS response received in ${Date.now() - fetchStart}ms`);
    console.log(`[AssetService] COS response status: ${response.status} ${response.statusText}`);
    console.log(`[AssetService] COS response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[AssetService] ========== COS UPLOAD FAILED ==========`);
      console.error(`[AssetService] Status: ${response.status}`);
      console.error(`[AssetService] Error body: ${errorBody}`);
      throw new AssetError(
        `Upload failed: ${response.status} - ${errorBody.slice(0, 200)}`,
        'UPLOAD_FAILED'
      );
    }

    console.log(`[AssetService] COS upload SUCCESS in ${Date.now() - uploadStart}ms total`);

    // Get image dimensions
    const dimensions = this.getImageDimensions(imageData, contentType);
    console.log(`[AssetService] Image dimensions: ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown'}`);

    // Create asset record
    console.log(`[AssetService] Creating asset record in database...`);
    const dbStart = Date.now();
    const assetMetadata: Record<string, unknown> = {
      source: {
        type: metadata.source?.type ?? (type === 'upload' ? 'upload' : 'generate'),
        origin: metadata.source?.origin ?? (type === 'upload' ? 'user_upload' : 'ai_generation'),
        timestamp: new Date().toISOString(),
      },
      scan: { status: 'pending' },
      dimensions,
    };

    if (type === 'generate') {
      assetMetadata.generation = {
        model: metadata.model,
        prompt: metadata.prompt,
        parameters: {
          resolution: metadata.resolution,
          aspectRatio: metadata.aspectRatio,
        },
      };
    }

    if (metadata.documentId) {
      assetMetadata.document_id = metadata.documentId;
    }

    const { error: assetError } = await this.supabase.from('assets').insert({
      id: assetId,
      project_id: projectId,
      user_id: userId,
      type,
      storage_path: storagePath,
      filename: `${filenamePrefix}-${assetId}.${extension}`,
      mime_type: contentType,
      size_bytes: imageData.byteLength,
      metadata: assetMetadata,
    });

    if (assetError) {
      console.error(`[AssetService] ========== DB INSERT FAILED ==========`);
      console.error(`[AssetService] Error:`, assetError);
      throw new AssetError(
        `Asset creation failed: ${assetError.message}`,
        'RECORD_FAILED'
      );
    }

    console.log(`[AssetService] Asset record created in ${Date.now() - dbStart}ms`);

    // Generate pre-signed URL for access (bypasses bucket ACL restrictions)
    const publicUrl = await this.getSignedUrl(storagePath, secretId, secretKey);
    console.log(`[AssetService] Signed URL generated (length: ${publicUrl.length})`);
    console.log(`[AssetService] ========== UPLOAD COMPLETE ==========`);
    console.log(`[AssetService] Total time: ${Date.now() - uploadStart}ms`);

    return {
      id: assetId,
      projectId,
      userId,
      storagePath,
      publicUrl,
      mimeType: contentType,
      sizeBytes: imageData.byteLength,
      dimensions: dimensions || undefined,
    };
  }

  /**
   * Upload image and create asset record
   * Requirements: 5.2, 5.3, 5.6
   */
  async uploadImage(
    userId: string,
    projectId: string,
    imageData: ArrayBuffer,
    contentType: string,
    metadata: AssetMetadata
  ): Promise<AssetRecord> {
    return this.uploadAsset(userId, projectId, imageData, contentType, 'generate', metadata, 'generated');
  }

  async uploadUserAsset(
    userId: string,
    projectId: string,
    imageData: ArrayBuffer,
    contentType: string,
    options?: { documentId?: string }
  ): Promise<AssetRecord> {
    return this.uploadAsset(
      userId,
      projectId,
      imageData,
      contentType,
      'upload',
      {
        source: {
          type: 'upload',
          origin: 'user_upload',
        },
        documentId: options?.documentId,
      },
      'upload'
    );
  }

  /**
   * Get public URL for a storage path (unsigned, requires bucket public-read)
   * Requirements: 5.4
   */
  getPublicUrl(storagePath: string): string {
    return `${COS_PUBLIC_URL}/${storagePath}`;
  }

  /**
   * Get pre-signed URL for a storage path (works with private buckets)
   * Default validity: 1 year
   */
  async getSignedUrl(
    storagePath: string,
    secretId?: string,
    secretKey?: string,
    expirySeconds: number = 31536000
  ): Promise<string> {
    const sid = secretId || Deno.env.get('COS_SECRET_ID');
    const skey = secretKey || Deno.env.get('COS_SECRET_KEY');
    if (!sid || !skey) {
      // Fallback to unsigned URL if credentials unavailable
      console.warn(`[AssetService] COS credentials not available for signing, using unsigned URL`);
      return this.getPublicUrl(storagePath);
    }
    return generatePresignedUrl(`/${storagePath}`, sid, skey, expirySeconds);
  }

  /**
   * Validate user owns an asset
   * Requirements: 5.5
   */
  async validateOwnership(userId: string, assetId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('assets')
      .select('user_id')
      .eq('id', assetId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.user_id === userId;
  }

  /**
   * Get image dimensions from raw image data
   * Supports PNG and JPEG formats
   */
  getImageDimensions(
    data: ArrayBuffer,
    contentType: string
  ): { width: number; height: number } | null {
    const bytes = new Uint8Array(data);

    // PNG: dimensions at bytes 16-23
    if (contentType.includes('png') && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }

    // JPEG: parse markers to find SOF0/SOF2
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + length;
      }
    }

    return null;
  }
}
