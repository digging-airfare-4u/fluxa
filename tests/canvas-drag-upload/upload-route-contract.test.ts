import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canvas drag upload api contract', () => {
  it('defines authenticated multipart upload adapter that proxies to edge and keeps canonical response', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/assets/upload/route.ts'),
      'utf8',
    );

    expect(source).toContain('await request.formData()');
    expect(source).toContain("formData.get('projectId')");
    expect(source).toContain("formData.get('documentId')");
    expect(source).toContain("formData.get('file')");

    expect(source).toContain('/functions/v1/upload-asset');
    expect(source).not.toContain('ASSET_UPLOAD_BACKEND');
    expect(source).not.toContain("backend === 'legacy'");
    expect(source).toContain("'Authorization': authHeader");
    expect(source).toContain("'apikey': supabaseAnonKey");
    expect(source).toContain('body: formData');

    expect(source).toContain("'INVALID_REQUEST'");
    expect(source).toContain("'UNSUPPORTED_MIME_TYPE'");
    expect(source).toContain("'PAYLOAD_TOO_LARGE'");
    expect(source).toContain("'FORBIDDEN'");
    expect(source).toContain("'UNAUTHORIZED'");
    expect(source).toContain("'UPLOAD_FAILED'");
    expect(source).toContain("'INTERNAL_ERROR'");

    expect(source).toContain('assetId');
    expect(source).toContain('storagePath');
    expect(source).toContain('url');
    expect(source).toContain('mimeType');
    expect(source).toContain('sizeBytes');
    expect(source).toContain('dimensions');
  });
});
