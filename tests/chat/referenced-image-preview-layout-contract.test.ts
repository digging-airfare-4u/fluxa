import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Referenced image previews are now rendered through the AI Elements
 * `Attachments` component (see src/components/ai-elements/attachments.tsx).
 * The inward-expanding hover preview is provided by a Radix HoverCard, which
 * is portaled and collision-aware, so the old hand-rolled
 * `absolute right-0 bottom-full` overlay markup no longer exists. These
 * contract tests assert the new implementation keeps the same intent:
 *  - user-message reference previews use the Attachments grid variant
 *  - the transcript container never introduces horizontal scrolling
 */
describe('referenced image preview layout contract', () => {
  it('renders user-message reference previews through the Attachments component', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatMessage.tsx'),
      'utf8',
    );

    expect(source).toContain("from '@/components/ai-elements/attachments'");
    expect(source).toContain('<Attachments variant="grid">');
    expect(source).toContain('<AttachmentPreview />');
  });

  it('keeps inline hover previews anchored so they expand inward', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/ai-elements/attachments.tsx'),
      'utf8',
    );

    // HoverCard content is start-aligned and collision-aware, so previews open
    // toward the available space instead of overflowing the panel edge.
    expect(source).toContain('<HoverCardContent');
    expect(source).toContain('align="start"');
  });

  it('keeps the transcript container from introducing horizontal scrolling for hover previews', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('<Conversation className="flex-1 overflow-x-hidden">');
  });
});
