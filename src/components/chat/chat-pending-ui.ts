/**
 * Chat pending UI helpers
 * Requirements: keep transient generation state near the input area and
 * normalize agent process labels for user-facing display.
 */

import type { Message, MessageMetadata } from '@/lib/supabase/queries/messages';
import type { GenerationPhase } from '@/lib/store/useChatStore';

const ACTIVE_PENDING_PHASES: GenerationPhase[] = ['phase-a', 'phase-b'];
const GENERIC_PENDING_CONTENT = new Set([
  'Generating...',
  '正在生成...',
  'Thinking...',
  '思考中...',
  'Processing...',
  '处理中...',
]);

export interface AgentStatusMetrics {
  stepCount: number;
  toolCount: number;
  citationCount: number;
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

  const content = message.content.trim();
  const hasMeaningfulContent = content.length > 0 && !GENERIC_PENDING_CONTENT.has(content);
  const hasStructuredProcess = Boolean(metadata.processSummary)
    || Boolean(metadata.agentProcess?.steps?.length)
    || Boolean(metadata.agentProcess?.tools?.length)
    || Boolean(metadata.generatedImages?.length)
    || Boolean(metadata.citations?.length);

  return hasMeaningfulContent || hasStructuredProcess;
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
    stepCount: metadata?.agentProcess?.steps?.length ?? 0,
    toolCount: metadata?.agentProcess?.tools?.length ?? 0,
    citationCount: metadata?.citations?.length ?? 0,
  };
}
