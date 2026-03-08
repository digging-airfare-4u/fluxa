import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, createServiceClient, ApiAuthError } from '@/lib/supabase/server';

const COS_BUCKET = process.env.NEXT_PUBLIC_COS_BUCKET || 'fluxa-1390058464';
const COS_REGION = process.env.NEXT_PUBLIC_COS_REGION || 'ap-tokyo';
const COS_PUBLIC_URL = `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_UPLOAD_BYTES = Number(process.env.DRAG_DROP_UPLOAD_MAX_BYTES || 20 * 1024 * 1024);

async function hmacSha1(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-1', encoder.encode(message));
  return bufferToHex(hash);
}

async function generateCosAuth(
  method: string,
  path: string,
  headers: Record<string, string>,
  secretId: string,
  secretKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 600;
  const keyTime = `${now};${expiry}`;

  const signKey = bufferToHex(await hmacSha1(secretKey, keyTime));

  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const sortedHeaderKeys = Object.keys(lowerHeaders).sort();
  const headerList = sortedHeaderKeys.join(';');
  const httpHeaders = sortedHeaderKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(lowerHeaders[k])}`)
    .join('&');

  const httpString = `${method.toLowerCase()}\n${path}\n\n${httpHeaders}\n`;
  const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`;
  const signature = bufferToHex(await hmacSha1(signKey, stringToSign));

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
}

async function uploadToCos(storagePath: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error('COS credentials not configured');
  }

  const cosPath = `/${storagePath}`;
  const uploadUrl = `${COS_PUBLIC_URL}${cosPath}`;

  const signedHeaders: Record<string, string> = {
    'content-type': contentType,
    host: `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`,
    'x-cos-acl': 'public-read',
  };

  const authorization = await generateCosAuth('PUT', cosPath, signedHeaders, secretId, secretKey);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'Content-Length': String(data.byteLength),
      Host: `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`,
      'x-cos-acl': 'public-read',
    },
    body: new Uint8Array(data),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`COS upload failed: ${response.status} ${detail}`);
  }
}

function getImageDimensions(data: ArrayBuffer, mimeType: string): { width: number; height: number } | undefined {
  const bytes = new Uint8Array(data);

  if (mimeType.includes('png') && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { width, height };
  }

  if ((mimeType.includes('jpeg') || mimeType.includes('jpg')) && bytes.length >= 10) {
    let i = 2;
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + length;
    }
  }

  return undefined;
}

function getExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'bin';
}

export async function POST(request: NextRequest) {
  try {
    const { client, user } = await createAuthenticatedClient(request);
    const serviceClient = createServiceClient();

    const formData = await request.formData();
    const projectId = String(formData.get('projectId') || '');
    const documentId = formData.get('documentId');
    const file = formData.get('file');

    if (!projectId || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'projectId and file are required' } },
        { status: 400 }
      );
    }

    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Project access denied' } },
        { status: 403 }
      );
    }

    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_MIME_TYPE', message: 'Unsupported file type' } },
        { status: 400 }
      );
    }

    const sizeBytes = file.size;
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds max upload size' } },
        { status: 413 }
      );
    }

    const extension = getExtension(mimeType);
    const assetId = crypto.randomUUID();
    const storagePath = `${user.id}/${projectId}/${assetId}.${extension}`;
    const filename = file.name?.trim() || `upload-${assetId}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    await uploadToCos(storagePath, arrayBuffer, mimeType);

    const dimensions = getImageDimensions(arrayBuffer, mimeType);

    const metadata: Record<string, unknown> = {
      source: {
        type: 'upload',
        origin: 'user_upload',
        timestamp: new Date().toISOString(),
      },
    };

    if (documentId && typeof documentId === 'string' && documentId.trim().length > 0) {
      metadata.document_id = documentId.trim();
    }

    const { error: insertError } = await serviceClient
      .from('assets')
      .insert({
        id: assetId,
        project_id: projectId,
        user_id: user.id,
        type: 'upload',
        storage_path: storagePath,
        filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        metadata,
      });

    if (insertError) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: 'Failed to persist asset metadata' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assetId,
      storagePath,
      url: `${COS_PUBLIC_URL}/${storagePath}`,
      mimeType,
      sizeBytes,
      dimensions,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: error.message } },
        { status: 401 }
      );
    }

    console.error('[API/assets/upload] unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
