import { describe, expect, it, vi } from 'vitest';
import {
  appendCurrentUserTurn,
  bootstrapAgentHistoryFromMessages,
  createAgentAssistantMetadata,
  runAgentLoop,
  truncateAgentHistory,
  type AgentHistoryEntry,
} from '../../supabase/functions/_shared/utils/agent-orchestrator.ts';

describe('bootstrapAgentHistoryFromMessages', () => {
  it('bootstraps first agent turn from classic visible messages', () => {
    const history = bootstrapAgentHistoryFromMessages([
      { role: 'user', content: '帮我做个海报' },
      { role: 'assistant', content: '我建议用科技风。' },
      { role: 'system', content: 'internal' },
      { role: 'assistant', content: '' },
    ]);

    expect(history).toEqual([
      { role: 'user', content: '帮我做个海报' },
      { role: 'assistant', content: '我建议用科技风。' },
    ]);
  });
});

describe('truncateAgentHistory', () => {
  it('preserves system context while trimming older turns', () => {
    const history: AgentHistoryEntry[] = [
      { role: 'system', content: 'system context' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ];

    const truncated = truncateAgentHistory(history, 4);

    expect(truncated).toEqual([
      { role: 'system', content: 'system context' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ]);
  });
});

describe('appendCurrentUserTurn', () => {
  it('does not append a duplicate current user prompt when bootstrap history already ends with it', () => {
    const history: AgentHistoryEntry[] = [
      { role: 'system', content: 'system context' },
      { role: 'user', content: '你好' },
    ];

    const nextHistory = appendCurrentUserTurn(history, '你好');

    expect(nextHistory).toEqual(history);
  });
});

describe('runAgentLoop', () => {
  it('emits structured process events for planner, tool execution, and final text', async () => {
    const events: Array<{ type: string }> = [];

    const result = await runAgentLoop({
      history: [
        { role: 'system', content: 'system context' },
        { role: 'user', content: '帮我生成产品图并总结' },
      ],
      emitEvent: (event) => events.push({ type: event.type }),
      planner: vi.fn(async () => ({
        steps: [
          { id: 'step-1', title: '理解需求', status: 'pending' },
          { id: 'step-2', title: '生成图片', status: 'pending' },
        ],
        needsSearch: false,
        needsImageSearch: false,
        executionMode: 'generate_image',
        summary: '先生成图片，再整理回答。',
      })),
      executor: vi
        .fn()
        .mockResolvedValueOnce({
          kind: 'tool_call',
          tool: 'generate_image',
          prompt: '一张极简产品海报',
          stepId: 'step-2',
        })
        .mockResolvedValueOnce({
          kind: 'final',
          text: '已经生成了一张产品海报，并整理好了说明。',
          summary: '完成图片生成和总结。',
        }),
      runTool: vi.fn(async () => ({
        tool: 'generate_image',
        summary: '图片已生成',
        imageUrl: 'https://cdn.example.com/generated.png',
        assetId: 'asset-1',
      })),
      maxIterations: 5,
    });

    expect(result.finalText).toBe('已经生成了一张产品海报，并整理好了说明。');
    expect(result.generatedImages).toEqual([
      {
        assetId: 'asset-1',
        imageUrl: 'https://cdn.example.com/generated.png',
        prompt: '一张极简产品海报',
      },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'phase',
      'plan',
      'decision',
      'decision',
      'phase',
      'step_start',
      'tool_start',
      'tool_result',
      'step_done',
      'step_start',
      'text',
      'step_done',
    ]);
  });

  it('stops when the maximum iteration limit is reached', async () => {
    const result = await runAgentLoop({
      history: [{ role: 'system', content: 'system context' }],
      emitEvent: () => undefined,
      planner: async () => ({
        steps: [{ id: 'step-1', title: 'loop', status: 'pending' }],
        needsSearch: false,
        needsImageSearch: false,
        executionMode: 'direct',
        summary: 'loop',
      }),
      executor: async () => ({
        kind: 'tool_call',
        tool: 'generate_image',
        prompt: 'keep going',
        stepId: 'step-1',
      }),
      runTool: async () => ({
        tool: 'generate_image',
        summary: 'generated',
        imageUrl: 'https://cdn.example.com/generated.png',
      }),
      maxIterations: 2,
    });

    expect(result.terminationReason).toBe('max_iterations');
    expect(result.finalText).toContain('iteration limit');
  });

  it('emits citation events only for verified final sources', async () => {
    const events: Array<{ type: string }> = [];

    const result = await runAgentLoop({
      history: [{ role: 'system', content: 'system context' }],
      emitEvent: (event) => events.push({ type: event.type }),
      planner: async () => ({
        steps: [{ id: 'step-1', title: 'answer', status: 'pending' }],
        needsSearch: true,
        needsImageSearch: false,
        executionMode: 'direct',
        summary: 'verify and answer',
      }),
      executor: async () => ({
        kind: 'final',
        text: '这里是带引用的答案。',
        summary: '完成验证。',
        citations: [
          {
            title: 'Verified Source',
            url: 'https://example.com/source',
            domain: 'example.com',
          },
        ],
      }),
      runTool: async () => ({
        tool: 'fetch_url',
        summary: 'unused',
      }),
      maxIterations: 2,
    });

    expect(result.citations).toEqual([
      {
        title: 'Verified Source',
        url: 'https://example.com/source',
        domain: 'example.com',
      },
    ]);
    expect(events.map((event) => event.type)).toContain('citation');
  });
});

describe('createAgentAssistantMetadata', () => {
  it('builds persisted metadata with mode, model, process summary, and generated images', () => {
    const metadata = createAgentAssistantMetadata({
      modelName: 'Fluxa Agent',
      processSummary: '先规划，再执行。',
      generatedImages: [
        { imageUrl: 'https://cdn.example.com/generated.png', assetId: 'asset-1', prompt: 'poster' },
      ],
      citations: [],
    });

    expect(metadata).toMatchObject({
      mode: 'agent',
      modelName: 'Fluxa Agent',
      processSummary: '先规划，再执行。',
      generatedImages: [
        { imageUrl: 'https://cdn.example.com/generated.png', assetId: 'asset-1', prompt: 'poster' },
      ],
    });
  });
});
