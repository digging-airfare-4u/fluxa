import { describe, expect, it } from 'vitest';
import type { Message } from '@/lib/supabase/queries/messages';
import {
  formatAgentThinkingDuration,
  getAgentStatusMetrics,
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

  it('hides the docked generating indicator when the pending agent turn is already rendered in the transcript', () => {
    const messages: Message[] = [
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
    ];

    expect(shouldShowGeneratingIndicatorNearInput(messages, 'phase-b')).toBe(false);
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

  it('formats completed agent thinking duration with compact timer text', () => {
    expect(formatAgentThinkingDuration(undefined)).toBeNull();
    expect(formatAgentThinkingDuration(9_000)).toBe('00:09');
    expect(formatAgentThinkingDuration(271_000)).toBe('04:31');
  });

  it('derives compact agent status metrics from the message metadata', () => {
    const message = createMessage({
      metadata: {
        citations: [
          { title: 'A', url: 'https://a.test', domain: 'a.test' },
          { title: 'B', url: 'https://b.test', domain: 'b.test' },
        ],
        agentProcess: {
          steps: [
            { id: 'step-1', title: 'Search references', status: 'completed' },
            { id: 'step-2', title: 'Draft layout', status: 'completed' },
            { id: 'step-3', title: 'Polish copy', status: 'completed' },
          ],
          tools: [
            { tool: 'web_search', status: 'completed' },
            { tool: 'fetch_url', status: 'completed' },
          ],
        },
      },
    });

    expect(getAgentStatusMetrics(message.metadata)).toEqual({
      stepCount: 3,
      toolCount: 2,
      citationCount: 2,
    });
  });
});
