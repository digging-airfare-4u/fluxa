/**
 * Chat pending UI helpers
 * Requirements: keep transient generation state near the input area and
 * normalize agent process labels for user-facing display.
 */

import type { AgentToolActivity, Message, MessageMetadata } from '@/lib/supabase/queries/messages';
import type { GenerationPhase } from '@/lib/store/useChatStore';

const ACTIVE_PENDING_PHASES: GenerationPhase[] = ['phase-a', 'phase-b'];
const GENERIC_AGENT_STEP_TITLE_PATTERNS = [
  /^processing$/iu,
  /^处理中$/u,
  /^executing$/iu,
  /^执行中$/u,
  /^working(?:\s+on\s+it)?$/iu,
  /^处理中\.\.\.$/u,
  /^in\s+progress$/iu,
  /^pending$/iu,
];

export interface AgentStatusMetrics {
  stepCount: number;
  toolCount: number;
  citationCount: number;
}

export interface AgentToolUiPart {
  id: string;
  tool: AgentToolActivity['tool'];
  state: 'input-available' | 'output-available';
  inputText?: string;
  outputText?: string;
  imageUrl?: string;
  assetId?: string;
}

function getMessageMetadata(message: Message): MessageMetadata | undefined {
  return message.metadata as MessageMetadata | undefined;
}

function isActivePendingPhase(generationPhase: GenerationPhase): boolean {
  return ACTIVE_PENDING_PHASES.includes(generationPhase);
}

export function shouldShowGeneratingIndicatorNearInput(
  messages: Message[],
  generationPhase: GenerationPhase,
): boolean {
  if (!isActivePendingPhase(generationPhase)) {
    return false;
  }

  const pendingMessages = messages.filter((message) => getMessageMetadata(message)?.isPending === true);
  if (pendingMessages.length === 0) {
    return false;
  }

  return pendingMessages.some((message) => !shouldRenderMessageInTranscript(message, generationPhase));
}

export function shouldRenderMessageInTranscript(
  message: Message,
  generationPhase: GenerationPhase,
): boolean {
  const metadata = getMessageMetadata(message);

  if (metadata?.isPending !== true) {
    return true;
  }

  if (!isActivePendingPhase(generationPhase)) {
    return true;
  }

  if (metadata.mode !== 'agent') {
    return false;
  }

  return true;
}

export function sanitizeAgentProcessStepTitle(title: string, fallbackTitle: string): string {
  const cleanedTitle = title
    .replace(/^\s*step\s*[-_#:：.]?\s*\d+\s*[:：.\-)]*\s*/iu, '')
    .replace(/^\s*步骤\s*\d+\s*[:：.\-)]*\s*/u, '')
    .replace(/^\s*第\s*\d+\s*步\s*[:：.\-)]*\s*/u, '')
    .replace(/^\s*\d+\s*[:：.\-)]\s*/u, '')
    .trim();

  return cleanedTitle || fallbackTitle;
}

export function isMeaningfulAgentProcessStepTitle(title: string): boolean {
  const cleanedTitle = sanitizeAgentProcessStepTitle(title, '');
  if (!cleanedTitle) {
    return false;
  }

  return !GENERIC_AGENT_STEP_TITLE_PATTERNS.some((pattern) => pattern.test(cleanedTitle));
}

export function formatAgentThinkingDuration(durationMs?: number): string | null {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs < 0) {
    return null;
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getAgentStatusMetrics(metadata?: MessageMetadata): AgentStatusMetrics {
  return {
    stepCount: (metadata?.agentProcess?.steps ?? []).filter((step) => (
      isMeaningfulAgentProcessStepTitle(step.title)
    )).length,
    toolCount: metadata?.agentProcess?.tools?.length ?? 0,
    citationCount: metadata?.citations?.length ?? 0,
  };
}

export function buildAgentToolUiParts(tools?: AgentToolActivity[]): AgentToolUiPart[] {
  return (tools ?? []).map((tool, index) => ({
    id: `${tool.tool}-${index}`,
    tool: tool.tool,
    state: tool.status === 'completed' ? 'output-available' : 'input-available',
    inputText: tool.inputSummary,
    outputText: tool.resultSummary,
    imageUrl: tool.imageUrl,
    assetId: tool.assetId,
  }));
}
