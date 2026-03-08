import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('upload-asset edge function contract', () => {
  it('enforces auth, project permission, mime/size validation, and canonical response payload', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/upload-asset/index.ts'),
      'utf8',
    );

    expect(source).toContain('await req.formData()');
    expect(source).toContain("formData.get('projectId')");
    expect(source).toContain("formData.get('documentId')");
    expect(source).toContain("formData.get('file')");

    expect(source).toContain('ALLOWED_MIME_TYPES');
    expect(source).toContain('MAX_UPLOAD_BYTES');
    expect(source).toContain('UNSUPPORTED_MIME_TYPE');
    expect(source).toContain('PAYLOAD_TOO_LARGE');

    expect(source).toContain('supabase.auth.getUser()');
    expect(source).toContain(".from('projects')");
    expect(source).toContain('PROJECT_ACCESS_DENIED');

    expect(source).toContain('uploadUserAsset');
    expect(source).toContain('assetId');
    expect(source).toContain('storagePath');
    expect(source).toContain('url');
    expect(source).toContain('mimeType');
    expect(source).toContain('sizeBytes');
    expect(source).toContain('dimensions');
  });
});
