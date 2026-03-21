/**
 * Agent Orchestration Helpers
 * Provides pure planning/execution loop helpers, history bootstrapping, and
 * persisted metadata shaping for the Agent Edge Function.
 */

export type AgentHistoryRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentHistoryEntry {
  role: AgentHistoryRole;
  content: string;
  name?: string;
}

export interface AgentPlanStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AgentPlannerResult {
  steps: AgentPlanStep[];
  needsSearch: boolean;
  needsImageSearch: boolean;
  executionMode: 'direct' | 'generate_image';
  summary: string;
}

export interface AgentExecutorFinalResult {
  kind: 'final';
  text: string;
  summary?: string;
  citations?: AgentCitation[];
}

export type AgentExecutorToolCallResult =
  | {
      kind: 'tool_call';
      tool: 'generate_image';
      prompt: string;
      referenceImageUrl?: string;
      stepId?: string;
    }
  | {
      kind: 'tool_call';
      tool: 'web_search' | 'image_search';
      query: string;
      stepId?: string;
    }
  | {
      kind: 'tool_call';
      tool: 'fetch_url';
      url: string;
      stepId?: string;
    };

export type AgentExecutorResult = AgentExecutorFinalResult | AgentExecutorToolCallResult;

export interface AgentGeneratedImage {
  imageUrl: string;
  assetId?: string;
  prompt: string;
}

export interface AgentCitation {
  title: string;
  url: string;
  domain: string;
}

export interface AgentSearchCandidate {
  title: string;
  url: string;
  domain: string;
  verified: boolean;
}

export interface AgentImageCandidate {
  imageUrl: string;
  sourcePageUrl: string;
  sourcePageTitle: string;
  verified: boolean;
}

export interface AgentToolExecutionResult {
  tool: 'generate_image' | 'web_search' | 'fetch_url' | 'image_search';
  summary: string;
  imageUrl?: string;
  assetId?: string;
  searchResults?: AgentSearchCandidate[];
  verifiedCitation?: AgentCitation;
  imageCandidates?: AgentImageCandidate[];
  ingestedImages?: AgentGeneratedImage[];
}

export type AgentEvent =
  | { type: 'phase'; phase: string; label: string }
  | { type: 'plan'; steps: AgentPlanStep[] }
  | { type: 'decision'; key: 'needs_search' | 'needs_image_search'; value: boolean; reason?: string }
  | { type: 'step_start'; stepId: string; title: string }
  | { type: 'step_done'; stepId: string; summary?: string }
  | { type: 'tool_start'; tool: string; inputSummary?: string }
  | { type: 'tool_result'; tool: string; resultSummary?: string; imageUrl?: string; assetId?: string }
  | { type: 'citation'; citations: AgentCitation[] }
  | { type: 'text'; content: string };

export interface RunAgentLoopArgs {
  history: AgentHistoryEntry[];
  emitEvent: (event: AgentEvent) => void;
  planner: (history: AgentHistoryEntry[]) => Promise<AgentPlannerResult>;
  executor: (input: {
    history: AgentHistoryEntry[];
    plan: AgentPlannerResult;
    iteration: number;
    toolResults: AgentToolExecutionResult[];
  }) => Promise<AgentExecutorResult>;
  runTool: (call: AgentExecutorToolCallResult) => Promise<AgentToolExecutionResult>;
  maxIterations: number;
}

export interface RunAgentLoopResult {
  history: AgentHistoryEntry[];
  finalText: string;
  processSummary?: string;
  citations: AgentCitation[];
  generatedImages: AgentGeneratedImage[];
  plan: AgentPlannerResult;
  terminationReason: 'completed' | 'max_iterations';
}

export function bootstrapAgentHistoryFromMessages(
  messages: Array<{ role: string; content: string | null | undefined }>,
): AgentHistoryEntry[] {
  return messages.flatMap((message) => {
    if (!message.content?.trim()) {
      return [];
    }

    if (message.role !== 'user' && message.role !== 'assistant') {
      return [];
    }

    return [{ role: message.role, content: message.content.trim() } satisfies AgentHistoryEntry];
  });
}

export function truncateAgentHistory(
  history: AgentHistoryEntry[],
  maxEntries: number,
): AgentHistoryEntry[] {
  if (history.length <= maxEntries) {
    return history;
  }

  const systemEntries = history.filter((entry) => entry.role === 'system');
  const nonSystemEntries = history.filter((entry) => entry.role !== 'system');
  const keepNonSystemCount = Math.max(maxEntries - systemEntries.length, 0);
  const truncatedNonSystemEntries = nonSystemEntries.slice(-keepNonSystemCount);

  return [...systemEntries, ...truncatedNonSystemEntries];
}

export function appendCurrentUserTurn(
  history: AgentHistoryEntry[],
  prompt: string,
): AgentHistoryEntry[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return history;
  }

  const lastEntry = history[history.length - 1];
  if (lastEntry?.role === 'user' && lastEntry.content.trim() === trimmedPrompt) {
    return history;
  }

  return [...history, { role: 'user', content: trimmedPrompt }];
}

function getStep(
  plan: AgentPlannerResult,
  result: AgentExecutorResult,
  iteration: number,
): AgentPlanStep {
  if (result.kind === 'tool_call' && result.stepId) {
    const matchedStep = plan.steps.find((step) => step.id === result.stepId);
    if (matchedStep) return matchedStep;
  }

  return (
    plan.steps[Math.min(iteration, Math.max(plan.steps.length - 1, 0))] || {
      id: `step-${iteration + 1}`,
      title: `Step ${iteration + 1}`,
      status: 'pending',
    }
  );
}

export async function runAgentLoop(
  args: RunAgentLoopArgs,
): Promise<RunAgentLoopResult> {
  args.emitEvent({ type: 'phase', phase: 'planning', label: 'Planning' });
  const plan = await args.planner(args.history);
  args.emitEvent({ type: 'plan', steps: plan.steps });
  args.emitEvent({ type: 'decision', key: 'needs_search', value: plan.needsSearch });
  args.emitEvent({ type: 'decision', key: 'needs_image_search', value: plan.needsImageSearch });
  args.emitEvent({ type: 'phase', phase: 'executing', label: 'Executing' });

  const workingHistory = [...args.history];
  const citations: AgentCitation[] = [];
  const toolResults: AgentToolExecutionResult[] = [];
  const generatedImages: AgentGeneratedImage[] = [];

  for (let iteration = 0; iteration < args.maxIterations; iteration += 1) {
    const executionResult = await args.executor({
      history: workingHistory,
      plan,
      iteration,
      toolResults,
    });
    const step = getStep(plan, executionResult, iteration);

    args.emitEvent({ type: 'step_start', stepId: step.id, title: step.title });

    if (executionResult.kind === 'final') {
      workingHistory.push({ role: 'assistant', content: executionResult.text });
      if (executionResult.citations && executionResult.citations.length > 0) {
        args.emitEvent({ type: 'citation', citations: executionResult.citations });
      }
      args.emitEvent({ type: 'text', content: executionResult.text });
      args.emitEvent({ type: 'step_done', stepId: step.id, summary: executionResult.summary });

      return {
        history: workingHistory,
        finalText: executionResult.text,
        processSummary: executionResult.summary ?? plan.summary,
        citations: executionResult.citations ?? citations,
        generatedImages,
        plan,
        terminationReason: 'completed',
      };
    }

    args.emitEvent({
      type: 'tool_start',
      tool: executionResult.tool,
      inputSummary: 'prompt' in executionResult
        ? executionResult.prompt
        : 'query' in executionResult
          ? executionResult.query
          : executionResult.url,
    });

    const toolResult = await args.runTool(executionResult);
    toolResults.push(toolResult);
    workingHistory.push({
      role: 'tool',
      name: toolResult.tool,
      content: JSON.stringify(toolResult),
    });

    if (toolResult.imageUrl) {
      generatedImages.push({
        imageUrl: toolResult.imageUrl,
        assetId: toolResult.assetId,
        prompt: 'prompt' in executionResult ? executionResult.prompt : toolResult.summary,
      });
    }
    if (toolResult.ingestedImages && toolResult.ingestedImages.length > 0) {
      generatedImages.push(...toolResult.ingestedImages);
    }
    if (toolResult.verifiedCitation) {
      citations.push(toolResult.verifiedCitation);
    }

    args.emitEvent({
      type: 'tool_result',
      tool: toolResult.tool,
      resultSummary: toolResult.summary,
      imageUrl: toolResult.imageUrl,
      assetId: toolResult.assetId,
    });
    args.emitEvent({ type: 'step_done', stepId: step.id, summary: toolResult.summary });

    // Image generation is a terminal action — stop iterating to prevent
    // the executor from generating additional unwanted images.
    if (executionResult.tool === 'generate_image') {
      break;
    }
  }

  const finalText = 'Agent stopped after reaching the iteration limit.';
  workingHistory.push({ role: 'assistant', content: finalText });

  return {
    history: workingHistory,
    finalText,
    processSummary: 'Agent stopped after reaching the iteration limit.',
    citations,
    generatedImages,
    plan,
    terminationReason: 'max_iterations',
  };
}

export function createAgentAssistantMetadata(input: {
  modelName: string;
  processSummary?: string;
  generatedImages: AgentGeneratedImage[];
  citations: AgentCitation[];
  searchSummary?: string;
}): Record<string, unknown> {
  return {
    mode: 'agent',
    modelName: input.modelName,
    processSummary: input.processSummary,
    searchSummary: input.searchSummary,
    generatedImages: input.generatedImages,
    citations: input.citations,
  };
}
