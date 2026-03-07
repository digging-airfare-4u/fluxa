import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat panel share entry contract', () => {
  const file = resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx');
  const content = readFileSync(file, 'utf-8');

  it('renders a share trigger in header action area', () => {
    expect(content).toContain('Share2');
    expect(content).toContain('onClick={() => setIsShareOpen(true)}');
  });

  it('mounts ShareDialog with required identifiers', () => {
    expect(content).toContain('<ShareDialog');
    expect(content).toContain('open={isShareOpen}');
    expect(content).toContain('conversationId={conversationId}');
    expect(content).toContain('projectId={projectId}');
    expect(content).toContain('documentId={documentId}');
  });
});
