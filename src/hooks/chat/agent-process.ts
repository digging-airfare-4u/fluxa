/**
 * Agent process helpers
 * Requirements: 5.3, 5.4, 5.6, 5.7 - Frontend Agent timeline state and final message shaping
 */

import type { AgentSSEEvent } from '@/lib/api';
import type {
  AgentProcessDecision,
  AgentProcessStep,
  AgentProcessTimeline,
  AgentToolActivity,
  Message,
  MessageCitation,
  MessageGeneratedImage,
  MessageMetadata,
} from '@/lib/supabase/queries/messages';

export interface AgentPendingState {
  content: string;
  startedAt: number;
  processSummary?: string;
  searchSummary?: string;
  citations: MessageCitation[];
  generatedImages: MessageGeneratedImage[];
  agentProcess: AgentProcessTimeline;
}

function upsertDecision(
  decisions: AgentProcessDecision[],
  nextDecision: AgentProcessDecision,
): AgentProcessDecision[] {
  const existingIndex = decisions.findIndex((decision) => decision.key === nextDecision.key);
  if (existingIndex === -1) {
    return [...decisions, nextDecision];
  }

  return decisions.map((decision, index) => (
    index === existingIndex ? nextDecision : decision
  ));
}

function startStep(
  steps: AgentProcessStep[],
  stepId: string,
  title: string,
): AgentProcessStep[] {
  const existingIndex = steps.findIndex((step) => step.id === stepId);
  if (existingIndex === -1) {
    return [...steps, { id: stepId, title, status: 'in_progress' }];
  }

  return steps.map((step) => (
    step.id === stepId
      ? { ...step, title, status: 'in_progress' }
      : step
  ));
}

function completeStep(
  steps: AgentProcessStep[],
  stepId: string,
  summary?: string,
): AgentProcessStep[] {
  return steps.map((step) => (
    step.id === stepId
      ? { ...step, status: 'completed', summary }
      : step
  ));
}

function startTool(
  tools: AgentToolActivity[],
  tool: AgentToolActivity['tool'],
  inputSummary?: string,
): AgentToolActivity[] {
  return [...tools, { tool, status: 'running', inputSummary }];
}

function completeTool(
  tools: AgentToolActivity[],
  event: Extract<AgentSSEEvent, { type: 'tool_result' }>,
): AgentToolActivity[] {
  let matched = false;
  const nextTools = [...tools];
  for (let index = nextTools.length - 1; index >= 0; index -= 1) {
    const tool = nextTools[index];
    if (tool.tool === event.tool && tool.status === 'running') {
      nextTools[index] = {
        ...tool,
        status: 'completed',
        resultSummary: event.resultSummary,
        imageUrl: event.imageUrl,
        assetId: event.assetId,
      };
      matched = true;
      break;
    }
  }

  if (!matched) {
    nextTools.push({
      tool: event.tool,
      status: 'completed',
      resultSummary: event.resultSummary,
      imageUrl: event.imageUrl,
      assetId: event.assetId,
    });
  }

  return nextTools;
}

function appendGeneratedImage(
  generatedImages: MessageGeneratedImage[],
  image: MessageGeneratedImage,
): MessageGeneratedImage[] {
  if (generatedImages.some((item) => item.imageUrl === image.imageUrl)) {
    return generatedImages;
  }

  return [...generatedImages, image];
}

export function addGeneratedImageToPendingState(
  state: AgentPendingState,
  image: MessageGeneratedImage,
): AgentPendingState {
  return {
    ...state,
    generatedImages: appendGeneratedImage(state.generatedImages, image),
  };
}

function deriveSearchSummary(decisions: AgentProcessDecision[]): string | undefined {
  if (decisions.length === 0) {
    return undefined;
  }

  const searchDecision = decisions.find((decision) => decision.key === 'needs_search');
  const imageSearchDecision = decisions.find((decision) => decision.key === 'needs_image_search');

  if (!searchDecision && !imageSearchDecision) {
    return undefined;
  }

  if (searchDecision?.value || imageSearchDecision?.value) {
    return 'Search used in this Agent turn.';
  }

  return 'No external search used.';
}

export function createInitialAgentPendingState(): AgentPendingState {
  return {
    content: '',
    startedAt: Date.now(),
    citations: [],
    generatedImages: [],
    agentProcess: {
      phase: 'planning',
      label: 'Planning',
      steps: [],
      decisions: [],
      tools: [],
    },
  };
}

export function reduceAgentPendingState(
  state: AgentPendingState,
  event: AgentSSEEvent,
): AgentPendingState {
  switch (event.type) {
    case 'phase':
      return {
        ...state,
        agentProcess: {
          ...state.agentProcess,
          phase: event.phase,
          label: event.label,
        },
      };
    case 'plan':
      return {
        ...state,
        agentProcess: {
          ...state.agentProcess,
          steps: event.steps,
        },
      };
    case 'decision': {
      const decisions = upsertDecision(state.agentProcess.decisions ?? [], {
        key: event.key,
        value: event.value,
        reason: event.reason,
      });

      return {
        ...state,
        searchSummary: deriveSearchSummary(decisions),
        agentProcess: {
          ...state.agentProcess,
          decisions,
        },
      };
    }
    case 'step_start':
      return {
        ...state,
        agentProcess: {
          ...state.agentProcess,
          steps: startStep(state.agentProcess.steps ?? [], event.stepId, event.title),
        },
      };
    case 'step_done':
      return {
        ...state,
        processSummary: event.summary ?? state.processSummary,
        agentProcess: {
          ...state.agentProcess,
          steps: completeStep(state.agentProcess.steps ?? [], event.stepId, event.summary),
        },
      };
    case 'tool_start':
      return {
        ...state,
        agentProcess: {
          ...state.agentProcess,
          tools: startTool(state.agentProcess.tools ?? [], event.tool, event.inputSummary),
        },
      };
    case 'tool_result': {
      const generatedImages = event.imageUrl
        ? appendGeneratedImage(state.generatedImages, {
          imageUrl: event.imageUrl,
          assetId: event.assetId,
          prompt: event.resultSummary || event.tool,
        })
        : state.generatedImages;

      return {
        ...state,
        generatedImages,
        agentProcess: {
          ...state.agentProcess,
          tools: completeTool(state.agentProcess.tools ?? [], event),
        },
      };
    }
    case 'citation':
      return {
        ...state,
        citations: event.citations,
      };
    case 'text':
      return {
        ...state,
        content: event.content,
      };
    case 'error':
      return {
        ...state,
        content: event.message,
      };
    case 'done':
      return state;
  }
}

export function buildAgentPendingMetadata(
  state: AgentPendingState,
  modelName: string,
  clientKey?: string,
): MessageMetadata {
  return {
    clientKey,
    isPending: true,
    mode: 'agent',
    modelName,
    processSummary: state.processSummary,
    searchSummary: state.searchSummary,
    citations: state.citations,
    generatedImages: state.generatedImages,
    agentProcess: state.agentProcess,
  };
}

export function mergeAgentFinalMessage(
  message: Message,
  state: AgentPendingState,
  modelName: string,
  clientKey?: string,
): Message {
  const metadata = (message.metadata || {}) as MessageMetadata;
  const thinkingDurationMs = Date.now() - state.startedAt;

  const finalAgentProcess = state.agentProcess.steps?.length || state.agentProcess.tools?.length || state.agentProcess.decisions?.length
    ? { ...state.agentProcess, thinkingDurationMs }
    : metadata.agentProcess;

  return {
    ...message,
    metadata: {
      ...metadata,
      clientKey: metadata.clientKey || clientKey,
      isPending: false,
      mode: 'agent',
      modelName: metadata.modelName || modelName,
      processSummary: metadata.processSummary || state.processSummary,
      searchSummary: metadata.searchSummary || state.searchSummary,
      citations: metadata.citations || state.citations,
      generatedImages: metadata.generatedImages || state.generatedImages,
      agentProcess: finalAgentProcess,
    },
  };
}
