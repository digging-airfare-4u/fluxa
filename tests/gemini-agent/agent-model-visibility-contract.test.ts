import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent model visibility contract', () => {
  it('keeps agent-only system models out of the classic selectable model list', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const systemModels = [
      {
        id: 'classic-image',
        name: 'gemini-3-pro-image-preview',
        display_name: 'Nano Banana Pro',
        provider: 'google',
        description: null,
        type: 'image',
        is_default: true,
        is_enabled: true,
        sort_order: 1,
        points_cost: 40,
        usage_scope: 'classic',
        is_visible_in_selector: true,
        agent_role: null,
        supports_tool_calling: false,
      },
      {
        id: 'agent-hidden',
        name: 'fluxa-agent',
        display_name: 'Fluxa Agent',
        provider: 'system',
        description: 'Agent-only billing model',
        type: 'ops',
        is_default: false,
        is_enabled: true,
        sort_order: 99,
        points_cost: 12,
        usage_scope: 'agent',
        is_visible_in_selector: false,
        agent_role: 'executor',
        supports_tool_calling: true,
      },
    ];

    const models = resolveSelectableModels(systemModels, []);

    expect(models).toHaveLength(1);
    expect(models[0]?.value).toBe('gemini-3-pro-image-preview');
    expect(models.find((model) => model.value === 'fluxa-agent')).toBeUndefined();
  });

  it('preserves visible classic models and enabled BYOK models together', async () => {
    const { resolveSelectableModels } = await import(
      '@/lib/models/resolve-selectable-models'
    );

    const systemModels = [
      {
        id: 'classic-ops',
        name: 'gpt-4o-mini',
        display_name: 'GPT-4o mini',
        provider: 'openai',
        description: null,
        type: 'ops',
        is_default: true,
        is_enabled: true,
        sort_order: 1,
        points_cost: 10,
        usage_scope: 'classic',
        is_visible_in_selector: true,
        agent_role: null,
        supports_tool_calling: false,
      },
    ];

    const userConfigs = [
      {
        id: 'cfg-1',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_url: 'https://api.example.com',
        model_name: 'custom-model',
        display_name: 'My Custom Model',
        is_enabled: true,
        api_key_masked: '****abcd',
        model_identifier: 'user:cfg-1' as const,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = resolveSelectableModels(systemModels as any, userConfigs as any);

    expect(models.map((model) => model.value)).toEqual(['gpt-4o-mini', 'user:cfg-1']);
  });

  it('records migration contract for agent sessions and agent-only model metadata', () => {
    const baseMigrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260316120000_add_agent_sessions_and_model_visibility.sql',
    );
    const renameMigrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260317030000_rename_agent_runtime_model.sql',
    );

    expect(existsSync(baseMigrationPath)).toBe(true);
    expect(existsSync(renameMigrationPath)).toBe(true);

    const baseSql = existsSync(baseMigrationPath) ? readFileSync(baseMigrationPath, 'utf8') : '';
    const renameSql = existsSync(renameMigrationPath) ? readFileSync(renameMigrationPath, 'utf8') : '';

    expect(baseSql).toContain('CREATE TABLE IF NOT EXISTS agent_sessions');
    expect(baseSql).toContain('conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE');
    expect(baseSql).toContain("history JSONB NOT NULL DEFAULT '[]'::JSONB");
    expect(baseSql).toContain('ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY');
    expect(baseSql).toContain('CREATE POLICY "Service role manages agent sessions"');
    expect(baseSql).toContain('ADD COLUMN IF NOT EXISTS usage_scope TEXT NOT NULL DEFAULT \'classic\'');
    expect(baseSql).toContain('ADD COLUMN IF NOT EXISTS is_visible_in_selector BOOLEAN NOT NULL DEFAULT true');
    expect(baseSql).toContain('ADD COLUMN IF NOT EXISTS agent_role TEXT');
    expect(baseSql).toContain('ADD COLUMN IF NOT EXISTS supports_tool_calling BOOLEAN NOT NULL DEFAULT false');
    expect(baseSql).toContain('is_visible_in_selector = false');
    expect(baseSql).toContain("usage_scope = 'agent'");

    expect(renameSql).toContain("'fluxa-agent'");
    expect(renameSql).toContain("'Fluxa Agent'");
    expect(renameSql).toContain("UPDATE point_transactions");
    expect(renameSql).toContain("WHERE model_name = 'gemini-2.5-flash-agent'");
  });
});
