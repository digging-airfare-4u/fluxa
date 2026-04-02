import { describe, expect, it } from 'vitest';
import type { Message } from '@/lib/supabase/queries/messages';
import {
  sanitizeAgentProcessStepTitle,
  shouldRenderMessageInTranscript,
  shouldShowGeneratingIndicatorNearInput,
} from '@/components/chat/chat-pending-ui';

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'assistant',
    content: '',
    created_at: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('chat pending ui', () => {
  it('shows the docked generating indicator for pending agent turns too', () => {
    const messages: Message[] = [
      createMessage({
        metadata: {
          isPending: true,
          mode: 'agent',
        },
      }),
    ];

    expect(shouldShowGeneratingIndicatorNearInput(messages, 'phase-b')).toBe(true);
  });

  it('hides pending transcript rows when they only contain generic loading text', () => {
    expect(
      shouldRenderMessageInTranscript(
        createMessage({
          content: '正在生成...',
          metadata: {
            isPending: true,
            mode: 'agent',
            agentProcess: { phase: 'planning', label: 'Planning', steps: [] },
          },
        }),
        'phase-b',
      ),
    ).toBe(false);

    expect(
      shouldRenderMessageInTranscript(
        createMessage({
          content: '正在生成...',
          metadata: {
            isPending: true,
            mode: 'agent',
            agentProcess: {
              phase: 'executing',
              label: 'Executing',
              steps: [{ id: 'step-1', title: 'Step 1: Search references', status: 'in_progress' }],
            },
          },
        }),
        'phase-b',
      ),
    ).toBe(true);
  });

  it('removes generic step numbering prefixes from agent step titles', () => {
    expect(
      sanitizeAgentProcessStepTitle('Step 1: Search references', '处理中')
    ).toBe('Search references');

    expect(
      sanitizeAgentProcessStepTitle('step1 生成图片', '处理中')
    ).toBe('生成图片');

    expect(
      sanitizeAgentProcessStepTitle('第2步：整理结果', '处理中')
    ).toBe('整理结果');
  });
});
