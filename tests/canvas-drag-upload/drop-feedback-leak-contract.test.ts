import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canvas drop feedback and placeholder leak contract', () => {
  it('shows localized toasts for unsupported files and per-file failures', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain("t('canvas.drop_unsupported_file'");
    expect(source).toContain("t('canvas.drop_upload_failed'");
    expect(source).toContain('toast.error');
  });

  it('tracks active drop placeholders and clears them on unmount', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'),
      'utf8',
    );

    expect(source).toContain('activeDropPlaceholdersRef');
    expect(source).toContain('activeDropPlaceholdersRef.current.add(placeholderId)');
    expect(source).toContain('activeDropPlaceholdersRef.current.delete(placeholderId)');
    expect(source).toContain('for (const placeholderId of activeDropPlaceholdersRef.current)');
    expect(source).toContain('removePlaceholder(placeholderId)');
  });

  it('adds new drop feedback locale keys in both supported editor locales', () => {
    const en = readFileSync(
      resolve(process.cwd(), 'src/locales/en-US/editor.json'),
      'utf8',
    );
    const zh = readFileSync(
      resolve(process.cwd(), 'src/locales/zh-CN/editor.json'),
      'utf8',
    );

    expect(en).toContain('"drop_unsupported_file"');
    expect(en).toContain('"drop_upload_failed"');
    expect(zh).toContain('"drop_unsupported_file"');
    expect(zh).toContain('"drop_upload_failed"');
  });
});
