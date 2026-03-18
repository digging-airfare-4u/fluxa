import { describe, expect, it } from 'vitest';
import { createInitialAgentPendingState, mergeAgentFinalMessage, reduceAgentPendingState } from '@/hooks/chat/agent-process';
import type { AgentSSEEvent } from '@/lib/api';

describe('agent process state', () => {
  it('reduces timeline events into structured pending metadata state', () => {
    const events: AgentSSEEvent[] = [
      { type: 'phase', phase: 'executing', label: 'Executing' },
      {
        type: 'plan',
        steps: [
          { id: 'step-1', title: 'Search references', status: 'pending' },
          { id: 'step-2', title: 'Summarize findings', status: 'pending' },
        ],
      },
      { type: 'decision', key: 'needs_search', value: true },
      { type: 'step_start', stepId: 'step-1', title: 'Search references' },
      { type: 'tool_start', tool: 'web_search', inputSummary: 'latest ai design tools' },
      { type: 'tool_result', tool: 'web_search', resultSummary: 'Found verified sources' },
      {
        type: 'citation',
        citations: [{ title: 'Source A', url: 'https://example.com/a', domain: 'example.com' }],
      },
      {
        type: 'tool_result',
        tool: 'generate_image',
        resultSummary: 'Generated concept image',
        imageUrl: 'https://example.com/generated.png',
        assetId: 'asset-1',
      },
      { type: 'step_done', stepId: 'step-1', summary: 'References collected' },
      { type: 'text', content: 'Final answer draft' },
    ];

    const state = events.reduce(reduceAgentPendingState, createInitialAgentPendingState());

    expect(state.content).toBe('Final answer draft');
    expect(state.processSummary).toBe('References collected');
    expect(state.searchSummary).toBe('Search used in this Agent turn.');
    expect(state.agentProcess.phase).toBe('executing');
    expect(state.agentProcess.steps?.[0]).toMatchObject({
      id: 'step-1',
      status: 'completed',
      summary: 'References collected',
    });
    expect(state.agentProcess.decisions).toEqual([
      { key: 'needs_search', value: true, reason: undefined },
    ]);
    expect(state.agentProcess.tools?.[0]).toMatchObject({
      tool: 'web_search',
      status: 'completed',
      resultSummary: 'Found verified sources',
    });
    expect(state.citations).toEqual([
      { title: 'Source A', url: 'https://example.com/a', domain: 'example.com' },
    ]);
    expect(state.generatedImages).toEqual([
      {
        imageUrl: 'https://example.com/generated.png',
        assetId: 'asset-1',
        prompt: 'Generated concept image',
      },
    ]);
  });

  it('merges the pending process state into the persisted final backend message', () => {
    const state = reduceAgentPendingState(
      reduceAgentPendingState(
        createInitialAgentPendingState(),
        { type: 'text', content: 'Pending answer' },
      ),
      {
        type: 'citation',
        citations: [{ title: 'Source B', url: 'https://example.com/b', domain: 'example.com' }],
      },
    );

    const message = mergeAgentFinalMessage(
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Persisted final answer',
        created_at: '2026-03-16T00:00:00.000Z',
        metadata: { mode: 'agent', processSummary: 'Persisted summary' },
      },
      state,
      'Fluxa Agent',
    );

    expect(message.metadata).toMatchObject({
      mode: 'agent',
      modelName: 'Fluxa Agent',
      processSummary: 'Persisted summary',
      citations: [{ title: 'Source B', url: 'https://example.com/b', domain: 'example.com' }],
    });
  });
});
