import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_UPLOAD_BYTES = Number(process.env.DRAG_DROP_UPLOAD_MAX_BYTES || 20 * 1024 * 1024);

function mapErrorCode(status: number, edgeCode?: string): { code: string; status: number } {
  if (status === 401) {
    return { code: 'UNAUTHORIZED', status: 401 };
  }

  if (status === 403) {
    return { code: 'FORBIDDEN', status: 403 };
  }

  if (status === 413 || edgeCode === 'PAYLOAD_TOO_LARGE') {
    return { code: 'PAYLOAD_TOO_LARGE', status: 413 };
  }

  if (status === 400) {
    if (edgeCode === 'UNSUPPORTED_MIME_TYPE') {
      return { code: 'UNSUPPORTED_MIME_TYPE', status: 400 };
    }
    return { code: 'INVALID_REQUEST', status: 400 };
  }

  if (edgeCode === 'UPLOAD_FAILED') {
    return { code: 'UPLOAD_FAILED', status: 500 };
  }

  return { code: 'INTERNAL_ERROR', status: 500 };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const projectId = String(formData.get('projectId') || '').trim();
    const documentId = formData.get('documentId');
    const file = formData.get('file');

    if (!projectId || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'projectId and file are required' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_MIME_TYPE', message: 'Unsupported file type' } },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds max upload size' } },
        { status: 413 }
      );
    }

    const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/upload-asset`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': authHeader,
      },
      body: formData,
    });

    const data = await edgeResponse.json();

    if (!edgeResponse.ok) {
      const mapped = mapErrorCode(edgeResponse.status, data?.error?.code);
      return NextResponse.json(
        {
          error: {
            code: mapped.code,
            message: data?.error?.message || 'Upload failed',
          },
        },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      assetId: data.assetId,
      storagePath: data.storagePath,
      url: data.url,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      dimensions: data.dimensions,
    });
  } catch (error) {
    console.error('[API/assets/upload] unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
