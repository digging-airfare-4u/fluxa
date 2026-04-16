/**
 * AI Generation API Client
 * Unified API layer for image and ops generation
 * Uses Supabase Edge Functions directly via Supabase invoke and fetch-based SSE.
 * Requirements: 12.1-12.7 - AI design generation
 */

import type { Op } from '@/lib/canvas/ops.types';
import type {
  AgentProcessDecision,
  AgentProcessStep,
  Message,
  MessageCitation,
} from '@/lib/supabase/queries/messages';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for image generation
 */
export interface GenerateImageParams {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  imageUrl?: string;
  placeholderX?: number;
  placeholderY?: number;
  aspectRatio?: string;
  resolution?: string;
}

/**
 * Parameters for ops generation
 */
export interface GenerateOpsParams {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
}

export interface GenerateAgentParams {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string;
  imageModel?: string;
  aspectRatio?: string;
  resolution?: string;
  referenceImageUrl?: string;
}

/**
 * Parameters for image tool processing
 */
export interface ImageToolParams {
  projectId: string;
  documentId: string;
  tool: 'removeBackground' | 'upscale' | 'erase' | 'expand';
  imageUrl: string;
  targetX?: number;
  targetY?: number;
  model?: string;
  params?: Record<string, unknown>;
  source?: {
    type: 'canvas_tool';
    originLayerId?: string;
  };
}


/**
 * Successful image generation response
 */
export interface GenerateImageResult {
  jobId: string;
  pointsDeducted?: number;
  remainingPoints?: number;
}

/**
 * Successful ops generation response
 */
export interface GenerateOpsResult {
  plan: string;
  ops: Op[];
  pointsDeducted?: number;
  remainingPoints?: number;
}

/**
 * Successful image tool response
 */
export interface ImageToolResult {
  jobId: string;
  pointsDeducted?: number;
  remainingPoints?: number;
  modelUsed?: string;
}

export type AgentToolName = 'generate_image' | 'web_search' | 'fetch_url' | 'image_search';

export interface AgentPhaseEvent {
  type: 'phase';
  phase: string;
  label: string;
}

export interface AgentPlanEvent {
  type: 'plan';
  steps: AgentProcessStep[];
}

export interface AgentDecisionEvent {
  type: 'decision';
  key: AgentProcessDecision['key'];
  value: boolean;
  reason?: string;
}

export interface AgentStepStartEvent {
  type: 'step_start';
  stepId: string;
  title: string;
}

export interface AgentStepDoneEvent {
  type: 'step_done';
  stepId: string;
  summary?: string;
}

export interface AgentToolStartEvent {
  type: 'tool_start';
  tool: AgentToolName;
  inputSummary?: string;
}

export interface AgentToolResultEvent {
  type: 'tool_result';
  tool: AgentToolName;
  resultSummary?: string;
  imageUrl?: string;
  assetId?: string;
}

export interface AgentCitationEvent {
  type: 'citation';
  citations: MessageCitation[];
}

export interface AgentTextEvent {
  type: 'text';
  content: string;
}

export interface AgentErrorEvent {
  type: 'error';
  message: string;
}

export interface AgentDoneEvent {
  type: 'done';
  message: Message;
}

export type AgentSSEEvent =
  | AgentPhaseEvent
  | AgentPlanEvent
  | AgentDecisionEvent
  | AgentStepStartEvent
  | AgentStepDoneEvent
  | AgentToolStartEvent
  | AgentToolResultEvent
  | AgentCitationEvent
  | AgentTextEvent
  | AgentErrorEvent
  | AgentDoneEvent;


/**
 * API error response structure
 */
export interface ApiError {
  code: string;
  message: string;
  current_balance?: number;
  required_points?: number;
  model_name?: string;
  membership_level?: string;
}

/**
 * Generation API error with structured error data
 */
export class GenerationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Partial<ApiError>
  ) {
    super(message);
    this.name = 'GenerationApiError';
  }

  /**
   * Check if this is an insufficient points error
   */
  isInsufficientPoints(): boolean {
    return this.code === 'INSUFFICIENT_POINTS';
  }

  /**
   * Check if this is a user provider config invalid error
   */
  isUserProviderConfigInvalid(): boolean {
    return this.code === 'USER_PROVIDER_CONFIG_INVALID';
  }

  /**
   * Get insufficient points details if applicable
   */
  getInsufficientPointsDetails() {
    if (!this.isInsufficientPoints()) return null;
    return {
      code: this.code,
      current_balance: this.details?.current_balance ?? 0,
      required_points: this.details?.required_points ?? 0,
      model_name: this.details?.model_name,
      membership_level: this.details?.membership_level,
    };
  }

  /**
   * Get user provider config invalid details if applicable
   */
  getUserProviderConfigInvalidDetails() {
    if (!this.isUserProviderConfigInvalid()) return null;
    return {
      code: this.code,
      message: this.message,
    };
  }
}

interface AgentStreamOptions {
  onEvent?: (event: AgentSSEEvent) => void;
}

interface GenerateAgentStreamOptions extends AgentStreamOptions {
  signal?: AbortSignal;
}

type SupabaseClientModule = typeof import('@/lib/supabase/client');
type SupabaseClientInstance = SupabaseClientModule['supabase'];

let supabaseClientPromise: Promise<SupabaseClientInstance> | null = null;

async function getSupabaseClient(): Promise<SupabaseClientInstance> {
  supabaseClientPromise ??= import('@/lib/supabase/client').then((module) => module.supabase);
  return supabaseClientPromise;
}

async function getAccessToken(): Promise<string> {
  const supabase = await getSupabaseClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      throw new GenerationApiError(
        'Authentication required',
        'AUTH_REQUIRED',
        401,
      );
    }
  }

  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const accessToken = currentSession?.access_token;
  if (!accessToken) {
    throw new GenerationApiError(
      'No access token available',
      'AUTH_REQUIRED',
      401,
    );
  }

  return accessToken;
}

async function refreshAccessToken(): Promise<string> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new GenerationApiError(
      'Authentication required',
      'AUTH_REQUIRED',
      401,
    );
  }

  return accessToken;
}

function parseAgentEvent(rawChunk: string): AgentSSEEvent | null {
  const lines = rawChunk
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join('\n')) as AgentSSEEvent;
  } catch {
    return null;
  }
}

export async function readAgentEventStream(
  response: Response,
  options: AgentStreamOptions = {},
): Promise<AgentDoneEvent | null> {
  if (!response.body) {
    throw new GenerationApiError(
      'Agent stream response is empty',
      'EMPTY_STREAM',
      response.status || 500,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneEvent: AgentDoneEvent | null = null;
  let streamErrorMessage: string | null = null;

  const flushBuffer = () => {
    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const event = parseAgentEvent(rawEvent);
      if (event) {
        options.onEvent?.(event);
        if (event.type === 'error') {
          streamErrorMessage = event.message;
        }
        if (event.type === 'done') {
          doneEvent = event;
        }
      }
      separatorIndex = buffer.indexOf('\n\n');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      flushBuffer();
      // Fallback: process any trailing data that didn't end with \n\n
      if (buffer.trim()) {
        const event = parseAgentEvent(buffer);
        if (event) {
          options.onEvent?.(event);
          if (event.type === 'error') {
            streamErrorMessage = event.message;
          }
          if (event.type === 'done') {
            doneEvent = event;
          }
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    flushBuffer();
  }

  if (streamErrorMessage && !doneEvent) {
    throw new GenerationApiError(
      streamErrorMessage,
      'AGENT_STREAM_ERROR',
      response.status || 500,
    );
  }

  return doneEvent;
}

export async function generateAgentStream(
  params: GenerateAgentParams,
  options: GenerateAgentStreamOptions = {},
): Promise<AgentDoneEvent | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new GenerationApiError(
      'Missing NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL_MISSING',
      500,
    );
  }

  if (!supabaseAnonKey) {
    throw new GenerationApiError(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY_MISSING',
      500,
    );
  }

  const functionUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/agent`;
  const requestBody = JSON.stringify({
    projectId: params.projectId,
    documentId: params.documentId,
    conversationId: params.conversationId,
    prompt: params.prompt,
    model: params.model,
    imageModel: params.imageModel,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    referenceImageUrl: params.referenceImageUrl,
  });

  const executeRequest = async (accessToken: string) => fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: requestBody,
    signal: options.signal,
  });

  let response = await executeRequest(await getAccessToken());

  if (response.status === 401) {
    response = await executeRequest(await refreshAccessToken());
  }

  if (!response.ok) {
    const responseText = await response.text();
    let parsedError: { error?: ApiError } | null = null;

    try {
      parsedError = JSON.parse(responseText) as { error?: ApiError };
    } catch {
      parsedError = null;
    }

    throw new GenerationApiError(
      parsedError?.error?.message || responseText || 'Agent generation failed',
      parsedError?.error?.code || 'AGENT_GENERATION_FAILED',
      response.status,
      parsedError?.error,
    );
  }

  return readAgentEventStream(response, { onEvent: options.onEvent });
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Generate image via AI using Supabase Edge Function
 * 
 * @param params - Image generation parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with job ID and points info
 * @throws GenerationApiError on failure
 */
export async function generateImage(
  params: GenerateImageParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateImageResult> {
  const supabase = await getSupabaseClient();
  const accessToken = await getAccessToken();

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    conversationId: params.conversationId,
    prompt: params.prompt,
    model: params.model,
    width: params.width ?? 1024,
    height: params.height ?? 1024,
    imageUrl: params.imageUrl,
    placeholderX: params.placeholderX,
    placeholderY: params.placeholderY,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
  };

  console.log('[generateImage] ========== CLIENT REQUEST START ==========');
  console.log('[generateImage] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[generateImage] ========== CLIENT REQUEST END ==========');

  // Use supabase.functions.invoke with explicit Authorization header
  const { data, error } = await supabase.functions.invoke<GenerateImageResult>('generate-image', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[generateImage] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[generateImage] Error:', error);
    console.error('[generateImage] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[generateImage] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[generateImage] ========== CLIENT RESPONSE END ==========');

  // Handle abort signal
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    // Parse error response
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;
    
    throw new GenerationApiError(
      apiError?.message || error.message || 'Image generation failed',
      apiError?.code || 'IMAGE_GENERATION_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from generate-image',
      'NO_DATA',
      500
    );
  }

  return data;
}

/**
 * Generate canvas ops via AI using Supabase Edge Function
 * 
 * @param params - Ops generation parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with plan and ops array
 * @throws GenerationApiError on failure
 */

/**
 * Run image tool via AI using Supabase Edge Function
 *
 * @param params - Image tool parameters
 * @param _accessToken - Deprecated: token is now handled automatically by Supabase SDK
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise with job ID and points info
 * @throws GenerationApiError on failure
 */
export async function runImageTool(
  params: ImageToolParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<ImageToolResult> {
  const supabase = await getSupabaseClient();
  const accessToken = await getAccessToken();

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    tool: params.tool,
    imageUrl: params.imageUrl,
    targetX: params.targetX,
    targetY: params.targetY,
    model: params.model,
    params: params.params,
    source: params.source,
  };

  console.log('[runImageTool] ========== CLIENT REQUEST START ==========');
  console.log('[runImageTool] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[runImageTool] ========== CLIENT REQUEST END ==========');

  const { data, error } = await supabase.functions.invoke<ImageToolResult>('image-tools', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[runImageTool] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[runImageTool] Error:', error);
    console.error('[runImageTool] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[runImageTool] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[runImageTool] ========== CLIENT RESPONSE END ==========');

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;

    throw new GenerationApiError(
      apiError?.message || error.message || 'Image tool processing failed',
      apiError?.code || 'IMAGE_TOOL_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from image-tools',
      'NO_DATA',
      500
    );
  }

  return data;
}

export async function generateOps(
  params: GenerateOpsParams,
  _accessToken?: string,
  signal?: AbortSignal
): Promise<GenerateOpsResult> {
  const supabase = await getSupabaseClient();
  const accessToken = await getAccessToken();

  const requestBody = {
    projectId: params.projectId,
    documentId: params.documentId,
    conversationId: params.conversationId,
    prompt: params.prompt,
    model: params.model,
  };

  console.log('[generateOps] ========== CLIENT REQUEST START ==========');
  console.log('[generateOps] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[generateOps] ========== CLIENT REQUEST END ==========');

  // Use supabase.functions.invoke with explicit Authorization header
  const { data, error } = await supabase.functions.invoke<GenerateOpsResult>('generate-ops', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  });

  console.log('[generateOps] ========== CLIENT RESPONSE START ==========');
  if (error) {
    console.error('[generateOps] Error:', error);
    console.error('[generateOps] Error Context:', JSON.stringify(error.context, null, 2));
  } else {
    console.log('[generateOps] Success Data:', JSON.stringify(data, null, 2));
  }
  console.log('[generateOps] ========== CLIENT RESPONSE END ==========');

  // Handle abort signal
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    // Parse error response
    const errorData = error.context as { error?: ApiError } | undefined;
    const apiError = errorData?.error;
    
    throw new GenerationApiError(
      apiError?.message || error.message || 'Generation failed',
      apiError?.code || 'GENERATION_FAILED',
      500,
      apiError
    );
  }

  if (!data) {
    throw new GenerationApiError(
      'No data returned from generate-ops',
      'NO_DATA',
      500
    );
  }

  return data;
}
