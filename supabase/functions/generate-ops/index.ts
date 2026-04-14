/**
 * Generate Ops Edge Function
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 * 
 * POST /functions/v1/generate-ops
 * 
 * Generates canvas operations from user prompts using LLM.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { createRegistry } from '../_shared/providers/registry-setup.ts';
import type { ChatMessage, ChatCompletionOptions } from '../_shared/providers/chat-types.ts';
import { errorToResponse, ProviderError, UserProviderConfigInvalidError } from '../_shared/errors/index.ts';
import {
  callChatProviderJson,
  isStructuredOutputFallbackEligible,
  retryWithExponentialBackoff,
} from '../_shared/utils/chat-provider-json.ts';
import { resolveChatProvider, type ResolvedChatProvider } from '../_shared/utils/resolve-chat-provider.ts';
import { resolveDefaultModel } from '../_shared/utils/resolve-default-model.ts';
import { DEFAULT_CHAT_MODEL } from '../_shared/defaults.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Error codes
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  AI_ERROR: 'AI_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
} as const;

// Op types for validation
const VALID_OP_TYPES = [
  'createFrame',
  'setBackground',
  'addText',
  'addImage',
  'updateLayer',
  'removeLayer',
] as const;

interface RequestBody {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  model?: string; // Optional model name from frontend
  assetsContext?: Array<{
    id: string;
    url: string;
    type: string;
  }>;
}

interface Op {
  type: string;
  payload: Record<string, unknown>;
}

interface GenerateOpsResponse {
  plan: string;
  ops: Op[];
}

/**
 * Points deduction result from RPC
 * Requirements: 2.1, 2.5, 2.6
 */
interface DeductPointsResult {
  success: boolean;
  points_deducted: number;
  balance_after: number;
  transaction_id: string;
}

/**
 * Insufficient points error details
 * Requirements: 2.6, 4.1
 */
interface InsufficientPointsError {
  code: 'INSUFFICIENT_POINTS';
  current_balance: number;
  required_points: number;
  model_name: string;
}

interface CurrentBalanceRow {
  points: number;
}

/**
 * System prompt for the LLM
 * Requirements: 17.1, 17.2
 */
const SYSTEM_PROMPT = `You are "ChatCanvas Design Agent", a specialized AI that generates structured design operations for a canvas-based design tool.

## Your Role
You output ONLY valid JSON in the format: {"plan": string, "ops": Op[]}
- "plan": A brief explanation of your design approach (1-3 sentences)
- "ops": An array of canvas operations to execute

## Available Op Types
1. setBackground - Set canvas background
   - payload: { backgroundType: "solid"|"gradient"|"image", value: string|GradientConfig }
   
2. addText - Add text layer
   - payload: { id: "layer-<uuid>", text: string, x: number, y: number, fontSize?: number, fontFamily?: string, fill?: string, fontWeight?: string, textAlign?: "left"|"center"|"right", width?: number }
   
3. addImage - Add image layer
   - payload: { id: "layer-<uuid>", src: string, x: number, y: number, width?: number, height?: number }
   
4. updateLayer - Update existing layer
   - payload: { id: string, properties: object }
   
5. removeLayer - Remove layer
   - payload: { id: string }

## Rules
1. Layer IDs MUST follow format: "layer-<8-char-hex>" (e.g., "layer-a1b2c3d4")
2. Default canvas size is 1080x1350 (portrait poster)
3. Use reasonable font sizes: titles 48-72px, subtitles 24-36px, body 16-20px
4. Position elements with proper spacing and alignment
5. Use hex colors (e.g., "#FFFFFF", "#7C3AED")
6. For text wrapping, set width property
7. NEVER reference external URLs unless provided in assetsContext
8. NEVER output anything except the JSON object

## Gradient Config Format
{
  "type": "linear"|"radial",
  "colorStops": [{"offset": 0, "color": "#color1"}, {"offset": 1, "color": "#color2"}]
}

## Example Output
{"plan":"Creating a promotional poster with gradient background, bold title, and subtitle","ops":[{"type":"setBackground","payload":{"backgroundType":"gradient","value":{"type":"linear","colorStops":[{"offset":0,"color":"#7C3AED"},{"offset":1,"color":"#06B6D4"}]}}},{"type":"addText","payload":{"id":"layer-title01","text":"Summer Sale","x":540,"y":400,"fontSize":72,"fontFamily":"Inter","fill":"#FFFFFF","fontWeight":"bold","textAlign":"center"}},{"type":"addText","payload":{"id":"layer-sub001","text":"Up to 50% off","x":540,"y":500,"fontSize":36,"fontFamily":"Inter","fill":"#FFFFFF","textAlign":"center"}}]}`;

/**
 * Few-shot example for better output quality (simplified for Volcengine)
 * Requirements: 17.2
 */
const FEW_SHOT_EXAMPLE = {
  user: '设计一张科技风格的海报',
  assistant: JSON.stringify({
    plan: '创建科技风格海报，使用渐变背景和现代排版',
    ops: [
      { type: 'setBackground', payload: { backgroundType: 'gradient', value: { type: 'linear', colorStops: [{ offset: 0, color: '#1E1B4B' }, { offset: 1, color: '#7C3AED' }] } } },
      { type: 'addText', payload: { id: 'layer-t1', text: 'AI Canvas', x: 540, y: 450, fontSize: 64, fontFamily: 'Inter', fill: '#FFFFFF', fontWeight: 'bold', textAlign: 'center' } },
    ],
  }),
};


/**
 * Validate request body
 */
function validateRequest(body: unknown): body is RequestBody {
  if (!body || typeof body !== 'object') return false;
  
  const b = body as Record<string, unknown>;
  
  return (
    typeof b.projectId === 'string' &&
    typeof b.documentId === 'string' &&
    typeof b.conversationId === 'string' &&
    typeof b.prompt === 'string' &&
    b.prompt.length > 0
  );
}

/**
 * Validate a single op
 */
function validateOp(op: unknown): op is Op {
  if (!op || typeof op !== 'object') return false;
  
  const o = op as Record<string, unknown>;
  
  if (typeof o.type !== 'string') return false;
  if (!VALID_OP_TYPES.includes(o.type as typeof VALID_OP_TYPES[number])) return false;
  if (!o.payload || typeof o.payload !== 'object') return false;
  
  // Validate specific op types
  switch (o.type) {
    case 'addText':
      return validateAddTextPayload(o.payload as Record<string, unknown>);
    case 'addImage':
      return validateAddImagePayload(o.payload as Record<string, unknown>);
    case 'setBackground':
      return validateSetBackgroundPayload(o.payload as Record<string, unknown>);
    case 'updateLayer':
      return validateUpdateLayerPayload(o.payload as Record<string, unknown>);
    case 'removeLayer':
      return validateRemoveLayerPayload(o.payload as Record<string, unknown>);
    default:
      return true;
  }
}

function validateAddTextPayload(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.id === 'string' &&
    /^layer-[a-zA-Z0-9-]+$/.test(payload.id) &&
    typeof payload.text === 'string' &&
    typeof payload.x === 'number' &&
    typeof payload.y === 'number'
  );
}

function validateAddImagePayload(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.id === 'string' &&
    /^layer-[a-zA-Z0-9-]+$/.test(payload.id) &&
    typeof payload.src === 'string' &&
    typeof payload.x === 'number' &&
    typeof payload.y === 'number'
  );
}

function validateSetBackgroundPayload(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.backgroundType === 'string' &&
    ['solid', 'gradient', 'image'].includes(payload.backgroundType) &&
    payload.value !== undefined
  );
}

function validateUpdateLayerPayload(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.id === 'string' &&
    typeof payload.properties === 'object' &&
    payload.properties !== null
  );
}

function validateRemoveLayerPayload(payload: Record<string, unknown>): boolean {
  return typeof payload.id === 'string';
}

/**
 * Validate the complete LLM response
 */
function validateLLMResponse(response: unknown): response is GenerateOpsResponse {
  if (!response || typeof response !== 'object') return false;
  
  const r = response as Record<string, unknown>;
  
  if (typeof r.plan !== 'string') return false;
  if (!Array.isArray(r.ops)) return false;
  
  // Validate each op
  for (const op of r.ops) {
    if (!validateOp(op)) return false;
  }
  
  return true;
}

/**
 * Get points cost for a model from database
 * Requirements: 2.1, 2.3
 */
async function getModelPointsCost(
  supabase: ReturnType<typeof createClient>,
  modelName: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_model_points_cost', {
    p_model_name: modelName,
  });

  if (error) {
    console.error('Error getting model points cost:', error);
    // Return default value if RPC fails
    return 10; // Default for text generation models
  }

  return data ?? 10;
}

/**
 * Get model display name from database
 */
async function getModelDisplayName(
  supabase: ReturnType<typeof createClient>,
  modelName: string
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('display_name')
    .eq('name', modelName)
    .single();

  if (error || !data) {
    return modelName;
  }

  return data.display_name || modelName;
}

/**
 * Deduct points from user balance
 * Requirements: 2.1, 2.5, 2.6
 */
async function deductPoints(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  source: string,
  referenceId: string | null,
  modelName: string
): Promise<{ success: true; result: DeductPointsResult } | { success: false; error: InsufficientPointsError }> {
  const { data, error } = await supabase.rpc('deduct_points', {
    p_user_id: userId,
    p_amount: amount,
    p_source: source,
    p_reference_id: referenceId,
    p_model_name: modelName,
  });

  if (error) {
    // Check if it's an insufficient points error
    if (error.message?.includes('Insufficient points')) {
      // Parse the error message to extract balance info
      const match = error.message.match(/current_balance=(\d+), required=(\d+)/);
      const currentBalance = match ? parseInt(match[1], 10) : 0;
      const requiredPoints = match ? parseInt(match[2], 10) : amount;

      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          current_balance: currentBalance,
          required_points: requiredPoints,
          model_name: modelName,
        },
      };
    }
    // Re-throw other errors
    throw new Error(`Points deduction failed: ${error.message}`);
  }

  return {
    success: true,
    result: data as DeductPointsResult,
  };
}

async function getCurrentPointsBalance(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('points')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch current points balance:', error);
    return 0;
  }

  return (data as CurrentBalanceRow | null)?.points ?? 0;
}

/**
 * Call the AI provider (OpenAI compatible)
 * Requirements: 12.3, 12.4, 17.3
 */
async function callAIProvider(
  prompt: string,
  runtime: ResolvedChatProvider,
  conversationId?: string,
  assetsContext?: RequestBody['assetsContext']
): Promise<GenerateOpsResponse> {
  // Build user message with assets context if provided
  let userMessage = prompt;
  if (assetsContext && assetsContext.length > 0) {
    userMessage += '\n\nAvailable assets:\n';
    for (const asset of assetsContext) {
      userMessage += `- ${asset.type}: ${asset.url}\n`;
    }
  }

  // Build messages array (provider adapters handle format translation)
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: FEW_SHOT_EXAMPLE.user },
    { role: 'assistant', content: FEW_SHOT_EXAMPLE.assistant },
    { role: 'user', content: userMessage },
  ];

  // Chat completion options — OpenAI providers use json_object format
  const options: ChatCompletionOptions = {
    temperature: 0.4,
    maxTokens: 2000,
  };
  // Call the unified chat provider interface
  let parsed: unknown;
  try {
    parsed = await retryWithExponentialBackoff(() => callChatProviderJson({
      provider: runtime.provider,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }), {
      provider: runtime.provider.name,
      model: runtime.displayName,
      diagnosticContext: {
        stage: 'generate-ops',
        conversationId,
        historyLength: messages.length,
      },
    });
  } catch (error) {
    if (isStructuredOutputFallbackEligible(error)) {
      return {
        plan: 'unable to comply: AI returned invalid JSON response',
        ops: [],
      };
    }
    throw error;
  }

  // Validate response structure
  if (!validateLLMResponse(parsed)) {
    // Requirement 17.4: Return rejection response for invalid schema
    return {
      plan: 'unable to comply: AI response did not match expected schema',
      ops: [],
    };
  }

  return parsed;
}


/**
 * Write ops to database
 * Requirements: 12.5
 */
async function writeOpsToDatabase(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  conversationId: string,
  messageId: string,
  ops: Op[]
): Promise<void> {
  if (ops.length === 0) return;
  
  const opsRecords = ops.map((op) => ({
    document_id: documentId,
    conversation_id: conversationId,
    message_id: messageId,
    op_type: op.type,
    payload: op.payload,
  }));
  
  const { error } = await supabase
    .from('ops')
    .insert(opsRecords);
  
  if (error) {
    throw new Error(`Failed to write ops: ${error.message}`);
  }
}

/**
 * Create assistant message
 */
async function createAssistantMessage(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  plan: string,
  ops: Op[]
): Promise<string> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: plan,
      metadata: { ops },
    })
    .select('id')
    .single();
  
  if (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
  
  return data.id;
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Method not allowed' },
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON body' },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate request
    if (!validateRequest(body)) {
      return new Response(
        JSON.stringify({
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Missing required fields: projectId, documentId, conversationId, prompt',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { projectId, documentId, conversationId, prompt, model, assetsContext } = body;
    
    // Initialize Supabase client with user's auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing authorization header. Please log in.' },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
    
    // Service client for points operations (bypasses RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user has access to the project (RLS will handle this)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.UNAUTHORIZED, message: `Project not found or access denied. Error: ${projectError?.message || 'No project data'}` },
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // =========================================================================
    // Get authenticated user for points deduction
    // Requirements: 2.1, 2.5, 2.6
    // =========================================================================
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid authentication' },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // =========================================================================
    // Points Deduction Logic
    // Requirements: 2.1, 2.5, 2.6
    // =========================================================================
    
    // Determine the model name for points calculation
    const resolvedDefault = await resolveDefaultModel(supabaseService, 'default_chat_model', DEFAULT_CHAT_MODEL);
    const selectedModel = model || resolvedDefault!;
    const registry = createRegistry(supabaseService);
    const runtime = await resolveChatProvider({
      serviceClient: supabaseService,
      registry,
      userId: user.id,
      selectedModel,
      fallbackModel: DEFAULT_CHAT_MODEL,
    });
    
    let pointsDeducted = 0;
    let remainingPoints = 0;

    if (runtime.isByok) {
      remainingPoints = await getCurrentPointsBalance(supabaseService, user.id);
    } else {
      const pointsCost = await getModelPointsCost(supabaseService, selectedModel);
      const deductionResult = await deductPoints(
        supabaseService,
        user.id,
        pointsCost,
        'generate_ops',
        null,
        selectedModel
      );

      if (!deductionResult.success) {
        const displayName = await getModelDisplayName(supabaseService, selectedModel);
        return new Response(
          JSON.stringify({
            error: {
              code: ERROR_CODES.INSUFFICIENT_POINTS,
              message: `点数不足，当前余额 ${deductionResult.error.current_balance}，需要 ${deductionResult.error.required_points} 点`,
              current_balance: deductionResult.error.current_balance,
              required_points: deductionResult.error.required_points,
              model_name: displayName,
            },
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      pointsDeducted = deductionResult.result.points_deducted;
      remainingPoints = deductionResult.result.balance_after;
    }
    
    // Call AI provider
    let result: GenerateOpsResponse;
    try {
      result = await callAIProvider(prompt, runtime, conversationId, assetsContext);
    } catch (error) {
      if (error instanceof UserProviderConfigInvalidError || error instanceof ProviderError) {
        return errorToResponse(error, corsHeaders);
      }
      console.error('AI provider error:', error);
      return new Response(
        JSON.stringify({
          error: {
            code: ERROR_CODES.AI_ERROR,
            message: error instanceof Error ? error.message : 'AI generation failed',
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If ops are empty (rejection case), still create message but don't write ops
    // Requirement 12.6: If validation fails, return error without writing to database
    // Note: Points were already deducted, so include that info in response
    if (result.ops.length === 0 && result.plan.startsWith('unable to comply')) {
      // Create assistant message with rejection
      await createAssistantMessage(supabase, conversationId, result.plan, []);
      
      return new Response(
        JSON.stringify({
          ...result,
          pointsDeducted,
          remainingPoints,
          modelUsed: selectedModel,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create assistant message
    const messageId = await createAssistantMessage(supabase, conversationId, result.plan, result.ops);
    
    // Write ops to database
    // Requirement 12.5: Write each op to the ops table
    await writeOpsToDatabase(supabase, documentId, conversationId, messageId, result.ops);
    
    // Return response with points information
    // Requirements: 2.1, 2.5, 2.6
    return new Response(
      JSON.stringify({
        ...result,
        pointsDeducted,
        remainingPoints,
        modelUsed: selectedModel,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return errorToResponse(error, corsHeaders);
  }
});
