import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('home quick tags contract', () => {
  const appHomePage = readFileSync(
    resolve(process.cwd(), 'src/app/app/page.tsx'),
    'utf-8'
  );
  const quickTags = readFileSync(
    resolve(process.cwd(), 'src/components/home/QuickTags.tsx'),
    'utf-8'
  );

  it('does not expose video in app home quick tags', () => {
    expect(appHomePage).not.toContain("{ id: 'video', label: 'Video', icon: Video }");
  });

  it('does not expose video in shared quick tag defaults', () => {
    expect(quickTags).not.toContain("{ id: 'video', label: '视频', icon: '🎬' },");
  });
});
