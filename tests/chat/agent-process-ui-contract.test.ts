import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent process ui contract', () => {
  it('renders a structured agent process panel in ChatMessage without exposing raw agent thinking', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatMessage.tsx'),
      'utf8',
    );

    expect(source).toContain("const isAgentMessage = metadata?.mode === 'agent'");
    expect(source).toContain("!isAgentMessage && metadata?.thinking");
    expect(source).toContain('<Reasoning');
    expect(source).toContain('<ReasoningTrigger');
    expect(source).toContain('<ReasoningContent');
    expect(source).toContain("t('message.agent_process')");
    expect(source).toContain("t('message.process_steps')");
    expect(source).toContain("t('message.process_tools')");
    expect(source).toContain('buildAgentToolUiParts');
    expect(source).toContain('isMeaningfulAgentProcessStepTitle');
    expect(source).toContain("t('message.citations')");
    expect(source).toContain('metadata?.generatedImages');
    expect(source).toContain('metadata?.citations');
    expect(source).not.toContain("t('message.process_decisions')");
  });

  it('merges pending agent timeline state into the persisted final message before replacement', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/hooks/chat/useGeneration.ts'),
      'utf8',
    );

    expect(source).toContain('reduceAgentPendingState');
    expect(source).toContain('buildAgentPendingMetadata');
    expect(source).toContain('syncPendingMessage();');
    expect(source).toContain('mergeAgentFinalMessage(doneEvent.message, pendingState, currentModelName, pendingMessageId)');
  });
});
