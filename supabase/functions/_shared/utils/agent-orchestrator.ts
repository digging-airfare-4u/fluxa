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

export interface StreamingExecutorInput {
  history: AgentHistoryEntry[];
  plan: AgentPlannerResult;
  iteration: number;
  toolResults: AgentToolExecutionResult[];
  emitTextDelta: (delta: string) => void;
}

export type StreamingExecutor = (
  input: StreamingExecutorInput,
) => Promise<AgentExecutorResult>;

export interface RunAgentLoopArgs {
  history: AgentHistoryEntry[];
  emitEvent: (event: AgentEvent) => void;
  planner: (history: AgentHistoryEntry[]) => Promise<AgentPlannerResult>;
  executor: StreamingExecutor;
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

const STREAM_FRAME_FALLBACK_CHARS = 48;
const STREAM_FRAME_LOOKAHEAD_CHARS = 18;
const STREAM_FRAME_DELAY_MS = 28;

export function splitIntoGraphemes(text: string): string[] {
  const segmenter = typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function'
    // deno-lint-ignore no-explicit-any
    ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  return segmenter
    ? Array.from(segmenter.segment(text), (segment: { segment: string }) => segment.segment)
    : Array.from(text);
}

export async function emitGraphemeDeltas(
  text: string,
  emitDelta: (delta: string) => void | Promise<void>,
  delayMs = STREAM_FRAME_DELAY_MS,
): Promise<void> {
  const graphemes = splitIntoGraphemes(text);
  for (let index = 0; index < graphemes.length; index += 1) {
    await emitDelta(graphemes[index]);
    if (delayMs > 0 && index < graphemes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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

export function buildProgressiveTextFrames(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= STREAM_FRAME_FALLBACK_CHARS) {
    for (let index = 0; index < normalized.length; index += 1) {
      if (/[。！？.!?,，；;：:]/u.test(normalized[index] ?? '') && index + 1 < normalized.length) {
        return [normalized.slice(0, index + 1), normalized];
      }
    }
  }

  const frames: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let nextCursor = Math.min(normalized.length, cursor + STREAM_FRAME_FALLBACK_CHARS);

    if (nextCursor < normalized.length) {
      const lookaheadLimit = Math.min(normalized.length, nextCursor + STREAM_FRAME_LOOKAHEAD_CHARS);
      let boundary = -1;

      for (let index = nextCursor; index < lookaheadLimit; index += 1) {
        if (/[。！？.!?,，；;：:\s]/u.test(normalized[index] ?? '')) {
          boundary = index + 1;
          break;
        }
      }

      if (boundary !== -1) {
        nextCursor = boundary;
      }
    }

    frames.push(normalized.slice(0, nextCursor));
    cursor = nextCursor;
  }

  if (frames[frames.length - 1] !== normalized) {
    frames.push(normalized);
  }

  return frames.filter((frame, index) => frame.length > 0 && frame !== frames[index - 1]);
}

async function emitProgressiveText(
  emitEvent: RunAgentLoopArgs['emitEvent'],
  text: string,
): Promise<void> {
  const frames = buildProgressiveTextFrames(text);

  for (let index = 0; index < frames.length; index += 1) {
    emitEvent({ type: 'text', content: frames[index] });

    if (index < frames.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, STREAM_FRAME_DELAY_MS));
    }
  }
}

/**
 * Stream plain (non-LLM) text to the client character-by-character using the
 * same `{type:'text', content: cumulative}` contract the LLM streamer uses.
 * Used for paths where text is generated locally (e.g. image-generation summary).
 */
async function emitStreamedPlainText(
  emitEvent: RunAgentLoopArgs['emitEvent'],
  text: string,
): Promise<void> {
  const normalized = text.trim();
  if (!normalized) return;
  let cumulative = '';
  await emitGraphemeDeltas(normalized, (delta) => {
    cumulative += delta;
    emitEvent({ type: 'text', content: cumulative });
  });
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
    let streamedText = '';
    const executionResult = await args.executor({
      history: workingHistory,
      plan,
      iteration,
      toolResults,
      emitTextDelta: (delta) => {
        if (!delta) return;
        streamedText += delta;
        args.emitEvent({ type: 'text', content: streamedText });
      },
    });
    const step = getStep(plan, executionResult, iteration);

    args.emitEvent({ type: 'step_start', stepId: step.id, title: step.title });

    if (executionResult.kind === 'final') {
      workingHistory.push({ role: 'assistant', content: executionResult.text });
      if (executionResult.citations && executionResult.citations.length > 0) {
        args.emitEvent({ type: 'citation', citations: executionResult.citations });
      }
      // Ensure frontend sees the final, complete text (in case streaming dropped anything).
      if (streamedText !== executionResult.text) {
        args.emitEvent({ type: 'text', content: executionResult.text });
      }
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

    // Image generation is a terminal action — return immediately to prevent
    // the executor from generating additional unwanted images.
    if (executionResult.tool === 'generate_image') {
      const summary = plan.summary || toolResult.summary;
      await emitStreamedPlainText(args.emitEvent, summary);

      return {
        history: workingHistory,
        finalText: summary,
        processSummary: summary,
        citations,
        generatedImages,
        plan,
        terminationReason: 'completed',
      };
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
