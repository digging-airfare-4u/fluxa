import { describe, expect, it } from 'vitest';
import type { Message } from '@/lib/supabase/queries/messages';
import {
  buildAgentToolUiParts,
  formatAgentThinkingDuration,
  getAgentStatusMetrics,
  isMeaningfulAgentProcessStepTitle,
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
  it('keeps pending agent turns in the transcript instead of duplicating a docked loading indicator', () => {
    const messages: Message[] = [
      createMessage({
        content: '正在生成...',
        metadata: {
          isPending: true,
          mode: 'agent',
        },
      }),
    ];

    expect(shouldShowGeneratingIndicatorNearInput(messages, 'phase-b')).toBe(false);
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

  it('renders pending agent transcript rows even before structured steps arrive', () => {
    expect(
      shouldRenderMessageInTranscript(
        createMessage({
          content: '正在生成...',
          metadata: {
            isPending: true,
            mode: 'agent',
          },
        }),
        'phase-b',
      ),
    ).toBe(true);

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

  it('filters out generic internal step titles from user-facing progress', () => {
    expect(isMeaningfulAgentProcessStepTitle('处理中')).toBe(false);
    expect(isMeaningfulAgentProcessStepTitle('Processing')).toBe(false);
    expect(isMeaningfulAgentProcessStepTitle('Executing')).toBe(false);
    expect(isMeaningfulAgentProcessStepTitle('Search references')).toBe(true);
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
            { id: 'step-3', title: '处理中', status: 'completed' },
            { id: 'step-4', title: 'Polish copy', status: 'completed' },
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

  it('adapts agent tool activity into structured ui parts', () => {
    const message = createMessage({
      metadata: {
        agentProcess: {
          tools: [
            {
              tool: 'web_search',
              status: 'running',
              inputSummary: 'latest ai poster trends',
            },
            {
              tool: 'generate_image',
              status: 'completed',
              inputSummary: 'generate a bright hero image',
              resultSummary: 'Created a wide hero concept',
              imageUrl: 'https://example.com/hero.png',
              assetId: 'asset-1',
            },
          ],
        },
      },
    });

    expect(buildAgentToolUiParts(message.metadata?.agentProcess?.tools)).toEqual([
      {
        id: 'web_search-0',
        tool: 'web_search',
        state: 'input-available',
        inputText: 'latest ai poster trends',
        outputText: undefined,
        imageUrl: undefined,
        assetId: undefined,
      },
      {
        id: 'generate_image-1',
        tool: 'generate_image',
        state: 'output-available',
        inputText: 'generate a bright hero image',
        outputText: 'Created a wide hero concept',
        imageUrl: 'https://example.com/hero.png',
        assetId: 'asset-1',
      },
    ]);
  });
});
