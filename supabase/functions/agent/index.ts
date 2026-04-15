/**
 * Agent Edge Function
 * Streams structured Agent events, persists session history, and resolves a
 * configurable chat provider as the Agent runtime brain.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import {
  AuthError,
  ProviderError,
  UserProviderConfigInvalidError,
  ValidationError,
  errorToResponse,
} from '../_shared/errors/index.ts';
import { AuthService } from '../_shared/services/auth.ts';
import { AssetService } from '../_shared/services/asset.ts';
import { PointsService } from '../_shared/services/points.ts';
import { createRegistry } from '../_shared/providers/registry-setup.ts';
import type { ProviderRegistry } from '../_shared/providers/registry.ts';
import { UserConfiguredImageProvider } from '../_shared/providers/user-configured-provider.ts';
import { OpenAICompatibleClient } from '../_shared/providers/openai-client.ts';
import { UserProviderService } from '../_shared/services/user-provider.ts';
import { isModelConfigEnabled } from '../_shared/observability/feature-flags.ts';
import { validateProviderHostAsync } from '../_shared/security/provider-host-allowlist.ts';
import { executeSharedImageGeneration, resolveSystemImageGenerationProvider } from '../_shared/utils/image-generation-core.ts';
import {
  callChatProviderJson,
  isStructuredOutputFallbackEligible,
  retryWithExponentialBackoff,
} from '../_shared/utils/chat-provider-json.ts';
import { resolveChatProvider, type ResolvedChatProvider } from '../_shared/utils/resolve-chat-provider.ts';
import { validateTrustedProjectReferenceImageUrl as validateTrustedReferenceImageUrl } from '../_shared/utils/trusted-reference-image.ts';
import {
  downloadExternalImage,
  fetchVerifiedPageContent,
  searchImages,
  searchWeb,
} from '../_shared/utils/agent-search.ts';
import {
  appendCurrentUserTurn,
  bootstrapAgentHistoryFromMessages,
  createAgentAssistantMetadata,
  emitGraphemeDeltas,
  runAgentLoop,
  truncateAgentHistory,
  type AgentCitation,
  type AgentExecutorResult,
  type AgentGeneratedImage,
  type AgentHistoryEntry,
  type AgentPlannerResult,
  type AgentToolExecutionResult,
} from '../_shared/utils/agent-orchestrator.ts';
import type { AspectRatio, ResolutionPreset } from '../_shared/types/index.ts';
import { resolveDefaultModel } from '../_shared/utils/resolve-default-model.ts';
import { DEFAULT_CHAT_MODEL, DEFAULT_AGENT_IMAGE_MODEL } from '../_shared/defaults.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_MODEL_NAME = 'fluxa-agent';
const AGENT_SYSTEM_CONTEXT = [
  'You are Fluxa Agent.',
  'Provide concise, helpful answers.',
  'Never reveal raw chain-of-thought.',
  'Use generate_image only when the user explicitly needs an image artifact.',
  'Available tools: web_search, fetch_url, image_search, generate_image.',
  'Search results are unverified until the page content has been fetched with fetch_url.',
  'Never cite or rely on a search result card directly without verification.',
].join(' ');
const MAX_ITERATIONS = 5;
const HISTORY_RETENTION = 24;
const PLANNER_HISTORY_LIMIT = 8;
const DEFAULT_RESOLUTION: ResolutionPreset = '1K';
const DEFAULT_ASPECT_RATIO: AspectRatio = '1:1';

interface AgentRequest {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
  imageModel?: string;
  aspectRatio?: AspectRatio;
  resolution?: ResolutionPreset;
  referenceImageUrl?: string;
}

interface PersistedAgentMessage {
  id: string;
  conversation_id: string;
  role: 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

async function resolveAgentBrainModel(
  serviceClient: SupabaseClient,
): Promise<string> {
  // Two-level DB fallback: agent_default_brain_model → default_chat_model → constant
  const agentSpecific = await resolveDefaultModel(serviceClient, 'agent_default_brain_model', null);
  if (agentSpecific) return agentSpecific;
  return (await resolveDefaultModel(serviceClient, 'default_chat_model', DEFAULT_CHAT_MODEL))!;
}

function validateRequest(body: unknown): AgentRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }

  const candidate = body as Record<string, unknown>;
  const fieldErrors: string[] = [];

  if (typeof candidate.projectId !== 'string' || !candidate.projectId) {
    fieldErrors.push('projectId is required');
  }
  if (typeof candidate.documentId !== 'string' || !candidate.documentId) {
    fieldErrors.push('documentId is required');
  }
  if (typeof candidate.conversationId !== 'string' || !candidate.conversationId) {
    fieldErrors.push('conversationId is required');
  }
  if (typeof candidate.prompt !== 'string' || !candidate.prompt.trim()) {
    fieldErrors.push('prompt is required');
  }

  if (fieldErrors.length > 0) {
    throw new ValidationError('Invalid request', fieldErrors);
  }

  return {
    projectId: candidate.projectId as string,
    documentId: candidate.documentId as string,
    conversationId: candidate.conversationId as string,
    prompt: (candidate.prompt as string).trim(),
    model: typeof candidate.model === 'string' && candidate.model.trim()
      ? candidate.model.trim()
      : undefined,
    imageModel: typeof candidate.imageModel === 'string' && candidate.imageModel.trim()
      ? candidate.imageModel.trim()
      : undefined,
    aspectRatio: typeof candidate.aspectRatio === 'string'
      ? candidate.aspectRatio as AspectRatio
      : undefined,
    resolution: typeof candidate.resolution === 'string'
      ? candidate.resolution as ResolutionPreset
      : undefined,
    referenceImageUrl: typeof candidate.referenceImageUrl === 'string'
      ? candidate.referenceImageUrl
      : undefined,
  };
}

function createSseResponse(
  execute: (sendEvent: (event: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      void (async () => {
        try {
          await execute(sendEvent);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Agent execution failed';
          sendEvent({ type: 'error', message });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function validateOwnership(
  client: SupabaseClient,
  request: AgentRequest,
): Promise<void> {
  const [{ data: project, error: projectError }, { data: document, error: documentError }, { data: conversation, error: conversationError }] = await Promise.all([
    client.from('projects').select('id').eq('id', request.projectId).single(),
    client.from('documents').select('id, project_id').eq('id', request.documentId).single(),
    client.from('conversations').select('id, project_id').eq('id', request.conversationId).single(),
  ]);

  if (projectError || !project) {
    throw new AuthError('Project not found or access denied', 'PROJECT_ACCESS_DENIED', 403);
  }
  if (documentError || !document) {
    throw new AuthError('Document not found', 'DOCUMENT_NOT_FOUND', 404);
  }
  if (conversationError || !conversation) {
    throw new AuthError('Conversation not found or access denied', 'CONVERSATION_ACCESS_DENIED', 403);
  }
  if (document.project_id !== request.projectId) {
    throw new AuthError('Document does not belong to the specified project', 'DOCUMENT_PROJECT_MISMATCH', 403);
  }
  if (conversation.project_id !== request.projectId) {
    throw new AuthError('Conversation does not belong to the specified project', 'CONVERSATION_PROJECT_MISMATCH', 403);
  }
}

async function loadAgentHistory(
  serviceClient: SupabaseClient,
  conversationId: string,
): Promise<AgentHistoryEntry[]> {
  const { data: session } = await serviceClient
    .from('agent_sessions')
    .select('history')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (Array.isArray(session?.history) && session.history.length > 0) {
    const normalized = session.history.filter((entry): entry is AgentHistoryEntry => (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).role === 'string' &&
      typeof (entry as Record<string, unknown>).content === 'string'
    )) as AgentHistoryEntry[];

    if (normalized[0]?.role === 'system') {
      return normalized;
    }

    return [{ role: 'system', content: AGENT_SYSTEM_CONTEXT }, ...normalized];
  }

  const { data: messages, error } = await serviceClient
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new ProviderError('Failed to bootstrap agent history from messages', 'DB_ERROR', error);
  }

  return [
    { role: 'system', content: AGENT_SYSTEM_CONTEXT },
    ...bootstrapAgentHistoryFromMessages([...(messages || [])].reverse().slice(-12)),
  ];
}

async function saveAgentHistory(
  serviceClient: SupabaseClient,
  conversationId: string,
  history: AgentHistoryEntry[],
): Promise<void> {
  const { error } = await serviceClient
    .from('agent_sessions')
    .upsert({
      conversation_id: conversationId,
      history,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new ProviderError('Failed to persist agent session', 'DB_ERROR', error);
  }
}

async function persistAssistantMessage(
  serviceClient: SupabaseClient,
  conversationId: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<PersistedAgentMessage> {
  const { data, error } = await serviceClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      metadata,
    })
    .select('id, conversation_id, role, content, metadata, created_at')
    .single();

  if (error || !data) {
    throw new ProviderError('Failed to persist agent assistant message', 'DB_ERROR', error);
  }

  return data as PersistedAgentMessage;
}

function createPlanner(
  runtime: ResolvedChatProvider,
  referenceImageUrl?: string,
  conversationId?: string,
): (history: AgentHistoryEntry[]) => Promise<AgentPlannerResult> {
  return async (history) => {
    // Limit history sent to planner to avoid context dilution that causes
    // models to ignore the JSON-only constraint.
    const plannerHistory = truncateAgentHistory(history, PLANNER_HISTORY_LIMIT);

    try {
      return await retryWithExponentialBackoff(() => callChatProviderJson<AgentPlannerResult>({
        provider: runtime.provider,
        messages: [
          {
            role: 'system',
            content: [
              'You are the planning stage for Fluxa Agent.',
              'You MUST return valid JSON only. No greetings, no explanation, no markdown fences.',
              'Schema: {"steps":[{"id":"step-1","title":"string","status":"pending"}],"needsSearch":boolean,"needsImageSearch":boolean,"executionMode":"direct"|"generate_image","summary":"string"}',
              'If the user requests an image asset or asks to modify/iterate on a previous image, choose executionMode="generate_image".',
              'If the user asks for fresh facts, citations, or external references, set needsSearch=true.',
              'If the user asks for visual references or inspiration from the web, set needsImageSearch=true.',
              'If a reference image is attached or the user refers to a previously generated image, analyze it to inform your plan.',
              'Keep the step list short and high signal.',
              'IMPORTANT: respond with the JSON object ONLY. Any non-JSON output is a fatal error.',
            ].join(' '),
          },
          {
            role: 'user',
            content: referenceImageUrl
              ? [
                  { type: 'text' as const, text: JSON.stringify({ history: plannerHistory }) },
                  { type: 'image_url' as const, image_url: { url: referenceImageUrl } },
                ]
              : JSON.stringify({ history: plannerHistory }),
          },
        ],
      }), {
        provider: runtime.provider.name,
        model: runtime.displayName,
        diagnosticContext: {
          stage: 'planner',
          conversationId,
          historyLength: plannerHistory.length,
          hasReferenceImage: Boolean(referenceImageUrl),
        },
      });
    } catch (error) {
      if (!isStructuredOutputFallbackEligible(error)) {
        throw error;
      }

      // Fallback: if the model returns non-JSON (e.g. plain text greeting),
      // return a safe default plan so the executor can still produce a response.
      console.error('[agent] planner JSON fallback triggered', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        steps: [{ id: 'step-1', title: 'Respond to user', status: 'pending' as const }],
        needsSearch: false,
        needsImageSearch: false,
        executionMode: 'direct' as const,
        summary: 'Direct response (planner fallback)',
      };
    }
  };
}

const EXECUTOR_SYSTEM_PROMPT = [
  'You are the execution stage for Fluxa Agent.',
  'You have two response modes: TOOL CALL or FINAL ANSWER.',
  'TOOL CALL mode: if you need to call a tool, respond with ONLY a single XML block, nothing else (no prose, no markdown, no prefix):',
  '<tool>{"tool":"generate_image","prompt":"string","referenceImageUrl":"optional trusted asset url","stepId":"step-id"}</tool>',
  'Other tool schemas (still wrapped in <tool>...</tool>):',
  '{"tool":"web_search","query":"string","stepId":"step-id"}',
  '{"tool":"fetch_url","url":"https://...","stepId":"step-id"}',
  '{"tool":"image_search","query":"string","stepId":"step-id"}',
  'FINAL ANSWER mode: if no tool is needed, reply with a plain-text answer directly. Do NOT wrap it in <tool>, JSON, or markdown fences. Just the answer prose.',
  'Decide mode at the very first token and commit to it for the whole response.',
  'Rules:',
  '- Use fetch_url before citing a web result.',
  '- Use image_search only for user-requested visual references; only use trusted image URLs from tool results.',
  '- If a reference image is attached, analyze it and incorporate observations.',
  '- When the user asks to modify/iterate on a previous image, find the imageUrl from the earlier generate_image tool result and pass it as referenceImageUrl.',
  '- Call generate_image at most ONCE per turn.',
  '- Do not fabricate citations or facts.',
  '- Do not include raw image URLs in the final text; the UI shows images separately.',
].join('\n');

interface ParsedToolCall {
  tool: string;
  prompt?: string;
  query?: string;
  url?: string;
  referenceImageUrl?: string;
  stepId?: string;
}

function toToolCallResult(parsed: ParsedToolCall): AgentExecutorResult {
  if (parsed.tool === 'generate_image' && typeof parsed.prompt === 'string') {
    return {
      kind: 'tool_call' as const,
      tool: 'generate_image',
      prompt: parsed.prompt,
      referenceImageUrl: parsed.referenceImageUrl,
      stepId: parsed.stepId,
    };
  }
  if ((parsed.tool === 'web_search' || parsed.tool === 'image_search') && typeof parsed.query === 'string') {
    return {
      kind: 'tool_call' as const,
      tool: parsed.tool,
      query: parsed.query,
      stepId: parsed.stepId,
    };
  }
  if (parsed.tool === 'fetch_url' && typeof parsed.url === 'string') {
    return {
      kind: 'tool_call' as const,
      tool: 'fetch_url',
      url: parsed.url,
      stepId: parsed.stepId,
    };
  }
  throw new ProviderError(
    `Executor returned an unrecognized tool call: ${JSON.stringify(parsed)}`,
    'PARSE_ERROR',
    { parsed },
    'agent-executor',
    undefined,
    502,
  );
}

const TOOL_OPEN = '<tool>';
const TOOL_CLOSE = '</tool>';
const EXECUTOR_GRAPHEME_DELAY_MS = 12;

function createExecutor(
  runtime: ResolvedChatProvider,
  referenceImageUrl?: string,
  conversationId?: string,
): (input: {
  history: AgentHistoryEntry[];
  plan: AgentPlannerResult;
  toolResults: AgentToolExecutionResult[];
  iteration: number;
  emitTextDelta: (delta: string) => void;
}) => Promise<AgentExecutorResult> {
  return async (input) => {
    const messages = [
      { role: 'system' as const, content: EXECUTOR_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: referenceImageUrl
          ? [
              { type: 'text' as const, text: JSON.stringify(input) },
              { type: 'image_url' as const, image_url: { url: referenceImageUrl } },
            ]
          : JSON.stringify({
              history: input.history,
              plan: input.plan,
              iteration: input.iteration,
              toolResults: input.toolResults,
            }),
      },
    ];
    const completionOptions = { temperature: 0.4, maxTokens: 4000 };

    // Fallback path: providers that don't implement chatCompletionStream get
    // a synthesized single-chunk generator from the non-streaming call. Tokens
    // arrive as one delta (no streaming UX) but the rest of the pipeline works.
    const openStream = async (): Promise<AsyncIterable<string>> => {
      if (runtime.provider.chatCompletionStream) {
        return runtime.provider.chatCompletionStream(messages, completionOptions);
      }
      const result = await runtime.provider.chatCompletion(messages, completionOptions);
      const text = result.content ?? '';
      async function* single() {
        if (text.length > 0) yield text;
      }
      return single();
    };

    // Track whether we have emitted any delta across attempts. If we have, we
    // must NOT retry (P2): retrying would re-stream a second response on top
    // of the prefix the client already received.
    let hasEmittedDelta = false;

    const executeStream = async (): Promise<AgentExecutorResult> => {
      const stream = await openStream();

      // Mode decision state:
      //  - undecided: accumulate prefix until we can tell tool vs text
      //  - 'tool': accumulate until </tool> closes
      //  - 'text': pass tokens straight to emitTextDelta
      let mode: 'undecided' | 'tool' | 'text' = 'undecided';
      let buffer = '';
      let accumulatedText = '';

      const flushAsText = async (delta: string) => {
        if (!delta) return;
        await emitGraphemeDeltas(delta, (grapheme) => {
          accumulatedText += grapheme;
          hasEmittedDelta = true;
          input.emitTextDelta(grapheme);
        }, EXECUTOR_GRAPHEME_DELAY_MS);
      };

      for await (const delta of stream) {
        if (mode === 'text') {
          await flushAsText(delta);
          continue;
        }

        buffer += delta;

        if (mode === 'undecided') {
          const leading = buffer.replace(/^\s+/, '');
          // Need enough chars to compare to TOOL_OPEN
          if (leading.length === 0) continue;

          if (leading.startsWith(TOOL_OPEN)) {
            mode = 'tool';
            // Drop any leading whitespace + the opening tag portion is kept in buffer for terminator detection below
          } else if (TOOL_OPEN.startsWith(leading)) {
            // Still could become a tool call; keep buffering.
            continue;
          } else {
            // It's plain text — flush buffered tokens through as text delta.
            mode = 'text';
            await flushAsText(buffer);
            buffer = '';
            continue;
          }
        }

        // mode === 'tool': look for closing tag
        const closeIdx = buffer.indexOf(TOOL_CLOSE);
        if (closeIdx !== -1) {
          const openIdx = buffer.indexOf(TOOL_OPEN);
          const jsonStart = openIdx === -1 ? 0 : openIdx + TOOL_OPEN.length;
          const jsonText = buffer.slice(jsonStart, closeIdx).trim();
          let parsed: ParsedToolCall;
          try {
            parsed = JSON.parse(jsonText) as ParsedToolCall;
          } catch (err) {
            throw new ProviderError(
              `Executor tool-call JSON was invalid: ${err instanceof Error ? err.message : String(err)}`,
              'PARSE_ERROR',
              { jsonText },
              'agent-executor',
              undefined,
              502,
            );
          }
          return toToolCallResult(parsed);
        }
      }

      // Stream ended
      if (mode === 'tool') {
        throw new ProviderError(
          'Executor stream ended without closing </tool> tag',
          'PARSE_ERROR',
          { buffer },
          'agent-executor',
          undefined,
          502,
        );
      }
      if (mode === 'undecided') {
        // Model produced only short content that looked like it could be a tool prefix; treat as text.
        if (buffer.trim()) {
          await flushAsText(buffer);
          buffer = '';
        }
      }

      const finalText = accumulatedText.trim();
      if (!finalText) {
        throw new ProviderError(
          'Executor stream produced empty final answer',
          'EMPTY_RESPONSE',
          undefined,
          'agent-executor',
          undefined,
          502,
        );
      }
      return {
        kind: 'final' as const,
        text: finalText,
        summary: input.plan.summary,
      };
    };

    // Manual retry: only retry when NO delta has been emitted yet. Once the
    // client has seen a partial prefix, a second attempt would stream a fresh
    // completion on top of the old one. We therefore abort retry immediately
    // if `hasEmittedDelta` is true.
    const MAX_ATTEMPTS = 2;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await executeStream();
      } catch (error) {
        lastError = error;
        const canRetry = !hasEmittedDelta && attempt < MAX_ATTEMPTS;
        console.error('[agent] executor streaming attempt failed', {
          conversationId,
          iteration: input.iteration,
          attempt,
          hasEmittedDelta,
          willRetry: canRetry,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!canRetry) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    throw lastError;
  };
}

function isUserModelIdentifier(model: string): model is `user:${string}` {
  return model.startsWith('user:');
}

function getUserConfigId(model: `user:${string}`): string {
  return model.slice('user:'.length);
}

async function resolveAgentImageProvider(args: {
  serviceClient: SupabaseClient;
  registry: ProviderRegistry;
  userId: string;
  selectedModel?: string;
  defaultModel: string;
}): Promise<{
  modelName: string;
  provider: UserConfiguredImageProvider | ReturnType<ProviderRegistry['getImageProvider']>;
}> {
  const selectedModel = args.selectedModel || args.defaultModel;

  if (!isUserModelIdentifier(selectedModel)) {
    const resolved = resolveSystemImageGenerationProvider({
      selectedModel,
      defaultModel: args.defaultModel,
      registry: args.registry,
    });

    return {
      modelName: resolved.modelName,
      provider: resolved.provider,
    };
  }

  const enabled = await isModelConfigEnabled(args.serviceClient);
  if (!enabled) {
    throw new ProviderError(
      'Custom provider configuration is currently disabled. Please try again later.',
      'FEATURE_DISABLED',
      undefined,
      'user-configured',
      selectedModel,
      503,
    );
  }

  const encryptionSecret = Deno.env.get('PROVIDER_ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new ProviderError(
      'Server configuration error: encryption secret not available',
      'CONFIG_ERROR',
      undefined,
      'user-configured',
      selectedModel,
      500,
    );
  }

  const userProviderService = new UserProviderService(args.serviceClient, encryptionSecret);
  const config = await userProviderService.getConfigById(
    args.userId,
    getUserConfigId(selectedModel),
    'image',
  );

  if (!config) {
    throw new UserProviderConfigInvalidError(
      'The selected image provider config is unavailable, disabled, or not configured for image generation.',
      { model: selectedModel },
    );
  }

  const hostValidation = await validateProviderHostAsync(config.api_url, {
    serviceClient: args.serviceClient,
  });
  if (!hostValidation.valid) {
    throw new UserProviderConfigInvalidError(
      hostValidation.reason,
      { model: selectedModel, source: hostValidation.source },
    );
  }

  return {
    modelName: selectedModel,
    provider: new UserConfiguredImageProvider(
      new OpenAICompatibleClient({
        apiUrl: config.api_url,
        apiKey: config.api_key,
        providerName: `user-configured:${config.provider}`,
      }),
      config,
    ),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', ['Only POST method is supported']);
    }

    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    const body = validateRequest(parsedBody);
    const authHeader = req.headers.get('Authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new ProviderError('Supabase environment variables are not configured', 'CONFIG_ERROR');
    }

    const authService = new AuthService(supabaseUrl, supabaseAnonKey);
    const { user, client } = await authService.validateUser(authHeader);
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    await validateOwnership(client, body);
    await validateTrustedReferenceImageUrl(serviceClient, body.projectId, body.referenceImageUrl);

    const registry = createRegistry(serviceClient);
    const defaultRuntimeModel = await resolveAgentBrainModel(serviceClient);
    const runtime = await resolveChatProvider({
      serviceClient,
      registry,
      userId: user.id,
      selectedModel: body.model || defaultRuntimeModel,
      fallbackModel: DEFAULT_CHAT_MODEL,
    });

    const pointsService = new PointsService(serviceClient);
    const agentCost = await pointsService.calculateCost(AGENT_MODEL_NAME, DEFAULT_RESOLUTION);
    await pointsService.deductPoints(user.id, agentCost, 'generate_ops', AGENT_MODEL_NAME);

    return createSseResponse(async (sendEvent) => {
      try {
        const baseHistory = await loadAgentHistory(serviceClient, body.conversationId);
        const userTurnHistory = truncateAgentHistory(
          appendCurrentUserTurn(baseHistory, body.prompt),
          HISTORY_RETENTION,
        );

        const loopResult = await runAgentLoop({
          history: userTurnHistory,
          maxIterations: MAX_ITERATIONS,
          emitEvent: (event) => sendEvent(event),
          planner: createPlanner(runtime, body.referenceImageUrl, body.conversationId),
          executor: createExecutor(runtime, body.referenceImageUrl, body.conversationId),
          runTool: async (call) => {
            return retryWithExponentialBackoff(async () => {
              if (call.tool === 'web_search') {
                const results = await searchWeb(call.query);
                return {
                  tool: 'web_search',
                  summary: results.length > 0
                    ? `Found ${results.length} unverified web results`
                    : 'No web search results found',
                  searchResults: results,
                };
              }

              if (call.tool === 'fetch_url') {
                const verifiedPage = await fetchVerifiedPageContent(call.url);
                return {
                  tool: 'fetch_url',
                  summary: `Verified source: ${verifiedPage.title}`,
                  verifiedCitation: {
                    title: verifiedPage.title,
                    url: verifiedPage.url,
                    domain: verifiedPage.domain,
                  },
                };
              }

              if (call.tool === 'image_search') {
                const imageCandidates = await searchImages(call.query, { maxPages: 3, maxResults: 4 });
                if (imageCandidates.length === 0) {
                  return {
                    tool: 'image_search',
                    summary: 'No image search results found',
                    imageCandidates: [],
                  };
                }

                const firstCandidate = imageCandidates[0];
                const assetService = new AssetService(serviceClient, supabaseUrl);
                const downloaded = await downloadExternalImage(firstCandidate.imageUrl);
                const ingestedAsset = await assetService.uploadImage(
                  user.id,
                  body.projectId,
                  downloaded.imageData,
                  downloaded.contentType,
                  {
                    source: {
                      type: 'search',
                      origin: firstCandidate.sourcePageUrl,
                    },
                    documentId: body.documentId,
                  } as never,
                );

                return {
                  tool: 'image_search',
                  summary: `Found ${imageCandidates.length} image candidates and ingested 1 trusted asset`,
                  imageCandidates,
                  ingestedImages: [
                    {
                      imageUrl: ingestedAsset.publicUrl,
                      assetId: ingestedAsset.id,
                      prompt: call.query,
                    },
                  ],
                };
              }

              const defaultImageModel = await resolveDefaultModel(serviceClient, 'default_image_model', DEFAULT_AGENT_IMAGE_MODEL);
              const resolvedImage = await resolveAgentImageProvider({
                serviceClient,
                registry,
                userId: user.id,
                selectedModel: body.imageModel || defaultImageModel!,
                defaultModel: DEFAULT_AGENT_IMAGE_MODEL,
              });
              const assetService = new AssetService(serviceClient, supabaseUrl);
              const imageResult = await executeSharedImageGeneration({
                provider: resolvedImage.provider,
                prompt: call.prompt,
                selectedModel: resolvedImage.modelName,
                resolution: body.resolution || DEFAULT_RESOLUTION,
                aspectRatio: body.aspectRatio || DEFAULT_ASPECT_RATIO,
                userId: user.id,
                projectId: body.projectId,
                assetService,
                imageUrl: call.referenceImageUrl || body.referenceImageUrl,
              });

              if (imageResult.kind === 'text-only') {
                return {
                  tool: 'generate_image',
                  summary: imageResult.output.textResponse,
                };
              }

              return {
                tool: 'generate_image',
                summary: 'Generated image asset',
                imageUrl: imageResult.jobOutput.publicUrl,
                assetId: imageResult.jobOutput.assetId,
              };
            });
          },
        });

        const truncatedHistory = truncateAgentHistory(loopResult.history, HISTORY_RETENTION);
        await saveAgentHistory(serviceClient, body.conversationId, truncatedHistory);

        const citations = loopResult.citations as AgentCitation[];
        const generatedImages = loopResult.generatedImages as AgentGeneratedImage[];
        const metadata = createAgentAssistantMetadata({
          modelName: runtime.displayName,
          processSummary: loopResult.processSummary,
          generatedImages,
          citations,
          searchSummary: loopResult.plan.needsSearch || loopResult.plan.needsImageSearch
            ? 'Search requested by planner but not yet executed in this phase.'
            : 'No external search used.',
        });
        const message = await persistAssistantMessage(
          serviceClient,
          body.conversationId,
          loopResult.finalText,
          metadata,
        );

        sendEvent({
          type: 'done',
          message,
        });
      } catch (error) {
        // Refund points on agent execution failure
        if (agentCost > 0) {
          await pointsService.refundPoints(
            user.id,
            agentCost,
            'generate_ops',
            AGENT_MODEL_NAME,
            'Refund for failed agent execution'
          );
        }
        throw error;
      }
    });
  } catch (error) {
    return errorToResponse(error, corsHeaders);
  }
});
