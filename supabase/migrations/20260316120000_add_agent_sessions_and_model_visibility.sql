-- Agent sessions and model visibility semantics
-- Requirements: 2.1-2.5

BEGIN;

CREATE TABLE IF NOT EXISTS agent_sessions (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  history JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages agent sessions" ON agent_sessions;
CREATE POLICY "Service role manages agent sessions"
  ON agent_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS supports_image_tool BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_scope TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS is_visible_in_selector BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_role TEXT,
  ADD COLUMN IF NOT EXISTS supports_tool_calling BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_usage_scope_check'
  ) THEN
    ALTER TABLE ai_models
      ADD CONSTRAINT ai_models_usage_scope_check
      CHECK (usage_scope IN ('classic', 'agent', 'all'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_agent_role_check'
  ) THEN
    ALTER TABLE ai_models
      ADD CONSTRAINT ai_models_agent_role_check
      CHECK (agent_role IS NULL OR agent_role IN ('planner', 'executor'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ai_models_usage_scope
  ON ai_models(usage_scope, is_enabled, is_visible_in_selector);

INSERT INTO ai_models (
  name,
  display_name,
  provider,
  description,
  type,
  is_default,
  is_enabled,
  sort_order,
  points_cost,
  supports_image_tool,
  usage_scope,
  is_visible_in_selector,
  agent_role,
  supports_tool_calling
) VALUES (
  'gemini-2.5-flash-agent',
  'Gemini Agent',
  'google',
  'Agent mode billing and display model',
  'ops',
  false,
  true,
  999,
  12,
  false,
  'agent',
  false,
  'executor',
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider = EXCLUDED.provider,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  points_cost = EXCLUDED.points_cost,
  supports_image_tool = EXCLUDED.supports_image_tool,
  usage_scope = 'agent',
  is_visible_in_selector = false,
  agent_role = EXCLUDED.agent_role,
  supports_tool_calling = EXCLUDED.supports_tool_calling;

COMMIT;
