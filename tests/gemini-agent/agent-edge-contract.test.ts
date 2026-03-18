import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readAgentEdgeSource(): string {
  return readFileSync(
    resolve(process.cwd(), 'supabase/functions/agent/index.ts'),
    'utf8',
  );
}

function readAgentEdgeConfig(): string {
  return readFileSync(
    resolve(process.cwd(), 'supabase/functions/agent/config.toml'),
    'utf8',
  );
}

function readAgentOrchestratorSource(): string {
  return readFileSync(
    resolve(process.cwd(), 'supabase/functions/_shared/utils/agent-orchestrator.ts'),
    'utf8',
  );
}

describe('agent edge function contract', () => {
  it('validates required fields and ownership checks before execution', () => {
    const source = readAgentEdgeSource();

    expect(source).toContain('projectId is required');
    expect(source).toContain('documentId is required');
    expect(source).toContain('conversationId is required');
    expect(source).toContain('prompt is required');
    expect(source).toContain('model: typeof candidate.model === \'string\'');
    expect(source).toContain('imageModel: typeof candidate.imageModel === \'string\'');
    expect(source).toContain("client.from('projects').select('id').eq('id', request.projectId).single()");
    expect(source).toContain("client.from('documents').select('id, project_id').eq('id', request.documentId).single()");
    expect(source).toContain("client.from('conversations').select('id, project_id').eq('id', request.conversationId).single()");
    expect(source).toContain('DOCUMENT_PROJECT_MISMATCH');
    expect(source).toContain('CONVERSATION_PROJECT_MISMATCH');
    expect(source).toContain('validateTrustedReferenceImageUrl');
  });

  it('streams structured SSE events including error and done', () => {
    const source = readAgentEdgeSource();

    expect(source).toContain("'Content-Type': 'text/event-stream'");
    expect(source).toContain("sendEvent({ type: 'error', message })");
    expect(source).toContain("type: 'done'");
    expect(source).toContain("emitEvent: (event) => sendEvent(event)");
  });

  it('disables gateway JWT verification so agent auth is handled inside the function', () => {
    const config = readAgentEdgeConfig();

    expect(config).toContain('verify_jwt = false');
  });

  it('implements search tools with verification and image ingestion', () => {
    const source = readAgentEdgeSource();

    expect(source).toContain("if (call.tool === 'web_search')");
    expect(source).toContain('searchWeb(call.query)');
    expect(source).toContain("if (call.tool === 'fetch_url')");
    expect(source).toContain('fetchVerifiedPageContent(call.url)');
    expect(source).toContain("if (call.tool === 'image_search')");
    expect(source).toContain('searchImages(call.query');
    expect(source).toContain('downloadExternalImage(firstCandidate.imageUrl)');
    expect(source).toContain('resolveAgentImageProvider({');
    expect(source).toContain('selectedModel: body.imageModel');
    expect(source).toContain("getConfigById(");
    expect(source).toContain("'image'");
    expect(source).toContain('new UserConfiguredImageProvider(');
    expect(source).toContain("type: 'search'");
    expect(source).toContain('ingestedImages');
  });

  it('persists agent history and exactly one final assistant message', () => {
    const source = readAgentEdgeSource();
    const orchestratorSource = readAgentOrchestratorSource();

    expect(source).toContain(".from('agent_sessions')");
    expect(source).toContain('.select(\'history\')');
    expect(source).toContain(".from('messages')");
    expect(source).toContain("role: 'assistant'");
    expect(source).toContain('saveAgentHistory(serviceClient, body.conversationId, truncatedHistory)');
    expect(source).toContain('persistAssistantMessage(');
    expect(source).toContain('createAgentAssistantMetadata({');
    expect(orchestratorSource).toContain("mode: 'agent'");
  });

  it('deducts agent points once per request and reuses shared image generation without double charge', () => {
    const source = readAgentEdgeSource();
    const deductPointsCalls = source.match(/deductPoints\(/g) || [];

    expect(deductPointsCalls).toHaveLength(1);
    expect(source).toContain("await pointsService.deductPoints(user.id, agentCost, 'generate_ops', AGENT_MODEL_NAME)");
    expect(source).toContain('executeSharedImageGeneration({');
  });

  it('resolves the agent runtime through the shared chat provider layer instead of hard-wired Gemini text calls', () => {
    const source = readAgentEdgeSource();

    expect(source).toContain('agent_default_brain_model');
    expect(source).toContain('resolveDefaultAgentRuntimeModel(serviceClient)');
    expect(source).toContain('resolveChatProvider({');
    expect(source).toContain('fallbackModel: defaultRuntimeModel');
    expect(source).toContain('planner: createPlanner(runtime, body.referenceImageUrl)');
    expect(source).toContain('executor: createExecutor(runtime, body.referenceImageUrl)');
    expect(source).not.toContain('GEMINI_API_KEY not configured');
  });
});
