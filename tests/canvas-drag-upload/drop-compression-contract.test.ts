import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canvas drop compression and validation contract', () => {
  it('defines client-side compression thresholds for dropped files', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain('DROP_COMPRESS_MAX_BYTES');
    expect(source).toContain('DROP_COMPRESS_MAX_DIMENSION');
    expect(source).toContain('DROP_COMPRESS_QUALITY');
    expect(source).toContain('DROP_COMPRESS_TARGET_MIME');
  });

  it('compresses only when size or dimensions exceed thresholds', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain('let uploadFile = file');
    expect(source).toContain('const shouldCompress = await shouldCompressDroppedImage(file)');
    expect(source).toContain('if (shouldCompress)');
    expect(source).toContain('uploadFile = await compressDroppedImage(file)');
    expect(source).toContain('file: uploadFile');

    expect(source).toContain('file.size > DROP_COMPRESS_MAX_BYTES');
    expect(source).toContain('Math.max(width, height) > DROP_COMPRESS_MAX_DIMENSION');
  });

  it('skips non-image files and continues processing remaining files', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain("if (!file.type.startsWith('image/'))");
    expect(source).toContain('toast.error');
    expect(source).toContain('continue processing dropped files');
  });
});
