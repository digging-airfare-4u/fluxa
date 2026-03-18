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
import { callChatProviderJson, retryWithExponentialBackoff } from '../_shared/utils/chat-provider-json.ts';
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_MODEL_NAME = 'fluxa-agent';
const DEFAULT_AGENT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_AGENT_RUNTIME_MODEL =
  Deno.env.get('AGENT_RUNTIME_MODEL')
  || Deno.env.get('DEFAULT_AI_MODEL')
  || 'doubao-seed-1-6-vision-250815';
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

async function resolveDefaultAgentRuntimeModel(
  serviceClient: SupabaseClient,
): Promise<string> {
  const { data, error } = await serviceClient
    .from('system_settings')
    .select('value')
    .eq('key', 'agent_default_brain_model')
    .maybeSingle();

  if (error) {
    console.warn(
      `[agent] Failed to load agent_default_brain_model, falling back to ${DEFAULT_AGENT_RUNTIME_MODEL}: ${error.message}`,
    );
    return DEFAULT_AGENT_RUNTIME_MODEL;
  }

  const configuredModel = (data?.value as { model?: unknown } | null)?.model;
  return typeof configuredModel === 'string' && configuredModel.trim()
    ? configuredModel.trim()
    : DEFAULT_AGENT_RUNTIME_MODEL;
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
): (history: AgentHistoryEntry[]) => Promise<AgentPlannerResult> {
  return (history) => retryWithExponentialBackoff(() => callChatProviderJson<AgentPlannerResult>({
    provider: runtime.provider,
    messages: [
      {
        role: 'system',
        content: [
          'You are the planning stage for Fluxa Agent.',
          'Return JSON only.',
          'Schema: {"steps":[{"id":"step-1","title":"string","status":"pending"}],"needsSearch":boolean,"needsImageSearch":boolean,"executionMode":"direct"|"generate_image","summary":"string"}',
          'If the user requests an image asset, choose executionMode="generate_image".',
          'If the user asks for fresh facts, citations, or external references, set needsSearch=true.',
          'If the user asks for visual references or inspiration from the web, set needsImageSearch=true.',
          'If a reference image is attached, analyze it to inform your plan.',
          'Keep the step list short and high signal.',
        ].join(' '),
      },
      {
        role: 'user',
        content: referenceImageUrl
          ? [
              { type: 'text' as const, text: JSON.stringify({ history }) },
              { type: 'image_url' as const, image_url: { url: referenceImageUrl } },
            ]
          : JSON.stringify({ history }),
      },
    ],
  }));
}

function createExecutor(
  runtime: ResolvedChatProvider,
  referenceImageUrl?: string,
): (input: {
  history: AgentHistoryEntry[];
  plan: AgentPlannerResult;
  toolResults: AgentToolExecutionResult[];
  iteration: number;
}) => Promise<AgentExecutorResult> {
  return (input) => retryWithExponentialBackoff(() => callChatProviderJson<AgentExecutorResult>({
    provider: runtime.provider,
    messages: [
      {
        role: 'system',
        content: [
          'You are the execution stage for Fluxa Agent.',
          'Return JSON only.',
          'Schema for final answer: {"kind":"final","text":"string","summary":"string","citations":[]}.',
          'Schema for generate_image: {"kind":"tool_call","tool":"generate_image","prompt":"string","referenceImageUrl":"optional trusted asset url","stepId":"step-id"}.',
          'Schema for web_search: {"kind":"tool_call","tool":"web_search","query":"string","stepId":"step-id"}.',
          'Schema for fetch_url: {"kind":"tool_call","tool":"fetch_url","url":"https://...","stepId":"step-id"}.',
          'Schema for image_search: {"kind":"tool_call","tool":"image_search","query":"string","stepId":"step-id"}.',
          'Use fetch_url before citing a web result.',
          'Use image_search when the user needs visual references, and only use trusted image URLs from tool results.',
          'If a reference image is attached, analyze it and incorporate your observations.',
          'Do not fabricate citations or verified facts.',
          'Do not include raw image URLs in the final text. Images are displayed separately by the UI.',
        ].join(' '),
      },
      {
        role: 'user',
        content: referenceImageUrl
          ? [
              { type: 'text' as const, text: JSON.stringify(input) },
              { type: 'image_url' as const, image_url: { url: referenceImageUrl } },
            ]
          : JSON.stringify(input),
      },
    ],
  }));
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
    const defaultRuntimeModel = await resolveDefaultAgentRuntimeModel(serviceClient);
    const runtime = await resolveChatProvider({
      serviceClient,
      registry,
      userId: user.id,
      selectedModel: body.model,
      fallbackModel: defaultRuntimeModel,
    });

    const pointsService = new PointsService(serviceClient);
    const agentCost = await pointsService.calculateCost(AGENT_MODEL_NAME, DEFAULT_RESOLUTION);
    await pointsService.deductPoints(user.id, agentCost, 'generate_ops', AGENT_MODEL_NAME);

    return createSseResponse(async (sendEvent) => {
      const baseHistory = await loadAgentHistory(serviceClient, body.conversationId);
      const userTurnHistory = truncateAgentHistory(
        appendCurrentUserTurn(baseHistory, body.prompt),
        HISTORY_RETENTION,
      );

      const loopResult = await runAgentLoop({
        history: userTurnHistory,
        maxIterations: MAX_ITERATIONS,
        emitEvent: (event) => sendEvent(event),
        planner: createPlanner(runtime, body.referenceImageUrl),
        executor: createExecutor(runtime, body.referenceImageUrl),
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

            const resolvedImage = await resolveAgentImageProvider({
              serviceClient,
              registry,
              userId: user.id,
              selectedModel: body.imageModel,
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
    });
  } catch (error) {
    return errorToResponse(error, corsHeaders);
  }
});
