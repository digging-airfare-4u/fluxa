-- Rename the agent billing/runtime model to a provider-neutral system record.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ai_models
    WHERE name = 'gemini-2.5-flash-agent'
  ) AND EXISTS (
    SELECT 1
    FROM ai_models
    WHERE name = 'fluxa-agent'
  ) THEN
    DELETE FROM ai_models
    WHERE name = 'gemini-2.5-flash-agent';
  ELSIF EXISTS (
    SELECT 1
    FROM ai_models
    WHERE name = 'gemini-2.5-flash-agent'
  ) THEN
    UPDATE ai_models
    SET name = 'fluxa-agent'
    WHERE name = 'gemini-2.5-flash-agent';
  END IF;
END;
$$;

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
  'fluxa-agent',
  'Fluxa Agent',
  'system',
  'Agent mode billing and runtime record',
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
  is_default = EXCLUDED.is_default,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  points_cost = EXCLUDED.points_cost,
  supports_image_tool = EXCLUDED.supports_image_tool,
  usage_scope = EXCLUDED.usage_scope,
  is_visible_in_selector = EXCLUDED.is_visible_in_selector,
  agent_role = EXCLUDED.agent_role,
  supports_tool_calling = EXCLUDED.supports_tool_calling;

UPDATE point_transactions
SET model_name = 'fluxa-agent'
WHERE model_name = 'gemini-2.5-flash-agent';

COMMIT;
