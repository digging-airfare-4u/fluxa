-- Add chat/image usage semantics to user BYOK configs.
-- Enables configurable chat providers for Agent runtime and classic ops generation.

ALTER TABLE user_provider_configs
  ADD COLUMN IF NOT EXISTS model_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE user_provider_configs
  DROP CONSTRAINT IF EXISTS user_provider_configs_model_type_check;

ALTER TABLE user_provider_configs
  ADD CONSTRAINT user_provider_configs_model_type_check
  CHECK (model_type IN ('image', 'chat'));

DROP INDEX IF EXISTS idx_user_provider_configs_user_model_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_configs_user_model_type_unique
  ON user_provider_configs(user_id, model_name, model_type);

DROP VIEW IF EXISTS user_provider_configs_safe;

CREATE OR REPLACE VIEW user_provider_configs_safe AS
SELECT
  id,
  user_id,
  provider,
  api_url,
  model_name,
  display_name,
  model_type,
  is_enabled,
  created_at,
  updated_at,
  CASE
    WHEN api_key_last4 IS NULL OR api_key_last4 = '' THEN '****'
    ELSE '****' || api_key_last4
  END AS api_key_masked
FROM user_provider_configs;

GRANT SELECT ON user_provider_configs_safe TO authenticated;

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
  'doubao-seed-1-6-vision-250815',
  '豆包 Deep Thinking',
  'volcengine',
  '豆包文本/多模态推理模型，可用于 classic ops 与 Agent brain。',
  'ops',
  false,
  true,
  20,
  10,
  false,
  'all',
  true,
  null,
  false
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider = EXCLUDED.provider,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  points_cost = EXCLUDED.points_cost,
  usage_scope = EXCLUDED.usage_scope,
  is_visible_in_selector = EXCLUDED.is_visible_in_selector,
  agent_role = EXCLUDED.agent_role,
  supports_tool_calling = EXCLUDED.supports_tool_calling;
