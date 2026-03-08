import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canvas drag upload api contract', () => {
  it('defines authenticated multipart upload route with validation and canonical response', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/assets/upload/route.ts'),
      'utf8',
    );

    expect(source).toContain('await request.formData()');
    expect(source).toContain('createAuthenticatedClient(request)');
    expect(source).toContain("formData.get('projectId')");
    expect(source).toContain("formData.get('documentId')");
    expect(source).toContain("formData.get('file')");

    expect(source).toContain('ALLOWED_MIME_TYPES');
    expect(source).toContain('MAX_UPLOAD_BYTES');
    expect(source).toContain("code: 'UNSUPPORTED_MIME_TYPE'");
    expect(source).toContain("code: 'PAYLOAD_TOO_LARGE'");

    expect(source).toContain('type: \'upload\'');
    expect(source).toContain("origin: 'user_upload'");
    expect(source).toContain('storage_path');
    expect(source).toContain('uploadToCos');

    expect(source).toContain('assetId');
    expect(source).toContain('storagePath');
    expect(source).toContain('mimeType');
    expect(source).toContain('sizeBytes');
    expect(source).toContain('dimensions');
  });
});
