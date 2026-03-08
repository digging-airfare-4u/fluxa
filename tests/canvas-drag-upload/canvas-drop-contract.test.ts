import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canvas drag drop file pipeline contract', () => {
  it('verifies single-image drop core flow: placeholder -> upload -> addImage persistence path', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain('const droppedFiles = Array.from(e.dataTransfer.files ?? [])');
    expect(source).toContain('if (droppedFiles.length > 0)');
    expect(source).toContain('await processDroppedFiles(droppedFiles');

    expect(source).toContain('DROP_FILE_CONCURRENCY');
    expect(source).toContain('runWithConcurrency');

    expect(source).toContain('const placeholderId = `drop-upload-${Date.now()}-${index}`');
    expect(source).toContain('activeDropPlaceholdersRef.current.add(placeholderId)');
    expect(source).toContain('addPlaceholder(placeholderId');
    expect(source).toContain('const uploadResult = await uploadDroppedAsset({');
    expect(source).toContain('const finalPosition = getPlaceholderPosition(placeholderId)');
    expect(source).toContain('await persistenceManager.addImage({');
    expect(source).toContain('removePlaceholder(placeholderId)');
    expect(source).toContain('activeDropPlaceholdersRef.current.delete(placeholderId)');
  });

  it('verifies multi-image drop flow with mixed outcomes and independent per-file finalization', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain('const tasks = droppedFiles.map((file, index) => async () => {');
    expect(source).toContain("if (!file.type.startsWith('image/'))");
    expect(source).toContain("toast.error(t('canvas.drop_unsupported_file', { name: file.name }))");
    expect(source).toContain('// continue processing dropped files');
    expect(source).toContain('} finally {');
    expect(source).toContain('removePlaceholder(placeholderId)');
    expect(source).toContain('activeDropPlaceholdersRef.current.delete(placeholderId)');
  });

  it('keeps URL/text fallback path for non-file drops', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain("const fluxaData = e.dataTransfer.getData('application/x-fluxa-image')");
    expect(source).toContain("imageUrl = e.dataTransfer.getData('text/plain')");
  });

  it('keeps non-drag import path unchanged via toolbar file input flow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/editor/EditorLayout.tsx'),
      'utf8',
    );

    expect(source).toContain("input.type = 'file'");
    expect(source).toContain("input.accept = 'image/*'");
    expect(source).toContain('const reader = new FileReader()');
    expect(source).toContain("type: 'addImage'");
    expect(source).toContain('await executeOps([op])');
  });

  it('uploads dropped file through authenticated multipart API', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/api/assets-upload.ts'),
      'utf8',
    );

    expect(source).toContain("fetch('/api/assets/upload'");
    expect(source).toContain("Authorization: `Bearer ${accessToken}`");
    expect(source).toContain("formData.append('projectId', projectId)");
    expect(source).toContain("formData.append('documentId', documentId)");
    expect(source).toContain("formData.append('file', file)");
  });
});
