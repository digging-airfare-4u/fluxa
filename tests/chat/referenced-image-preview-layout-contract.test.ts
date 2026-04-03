import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('referenced image preview layout contract', () => {
  it('anchors user-message reference previews to the right edge so they expand inward', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatMessage.tsx'),
      'utf8',
    );

    expect(source).toContain('absolute right-0 bottom-full');
    expect(source).not.toContain('absolute left-0 bottom-full');
  });

  it('keeps the transcript container from introducing horizontal scrolling for hover previews', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain("className=\"flex-1 overflow-x-hidden overflow-y-auto px-4 py-4\"");
  });
});
