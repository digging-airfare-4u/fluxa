-- AI Models Configuration
-- Stores available AI models for image and ops generation
-- Requirements: 5.1, 6.2, 6.6, 7.1

-- ============================================================================
-- Table: ai_models
-- Available AI models for generation (configured via database)
-- ============================================================================
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- Internal name (e.g., 'doubao-seedream-4-5-251128')
  display_name TEXT NOT NULL,          -- Display name (e.g., '豆包 Seedream')
  provider TEXT NOT NULL,              -- Provider (e.g., 'volcengine', 'google')
  description TEXT,                    -- Short description
  type TEXT DEFAULT 'ops',             -- Model type: 'image' for image generation, 'ops' for ops generation
  is_default BOOLEAN DEFAULT FALSE,    -- Default model for new conversations
  is_enabled BOOLEAN DEFAULT TRUE,     -- Whether model is available
  supports_image_tool BOOLEAN DEFAULT FALSE, -- Whether model supports image tools
  usage_scope TEXT NOT NULL DEFAULT 'classic', -- classic | agent | all
  is_visible_in_selector BOOLEAN NOT NULL DEFAULT TRUE, -- Hide agent-only models from classic selector
  agent_role TEXT,                     -- Reserved for planner / executor expansion
  supports_tool_calling BOOLEAN NOT NULL DEFAULT FALSE, -- Agent capability flag
  sort_order INTEGER DEFAULT 0,        -- Display order
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for enabled models
CREATE INDEX idx_ai_models_enabled ON ai_models(is_enabled, sort_order);

-- Index for model type queries
CREATE INDEX idx_ai_models_type ON ai_models(type, is_enabled);
CREATE INDEX idx_ai_models_image_tool ON ai_models(supports_image_tool, is_enabled);
CREATE INDEX idx_ai_models_usage_scope ON ai_models(usage_scope, is_enabled, is_visible_in_selector);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled models
CREATE POLICY "Anyone can read enabled models"
  ON ai_models FOR SELECT
  USING (is_enabled = true);

-- ============================================================================
-- Seed Data: Default AI Models
-- ============================================================================

-- Image generation models
INSERT INTO ai_models (name, display_name, provider, description, type, is_default, sort_order, supports_image_tool) VALUES
  ('doubao-seedream-4-5-251128', '豆包 Seedream', 'volcengine', '火山引擎图像生成模型', 'image', true, 1, true);

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

-- Gemini image model (Nano Banana Pro)
-- Requirements: 5.1, 6.2, 6.6, 7.1
INSERT INTO ai_models (name, display_name, provider, description, type, is_default, is_enabled, sort_order, supports_image_tool) VALUES
  ('gemini-3-pro-image-preview', 'Nano Banana Pro', 'google', 'Google Gemini 专业图像生成，支持 4K 输出', 'image', false, true, 2, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider = EXCLUDED.provider,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_enabled = EXCLUDED.is_enabled;

INSERT INTO ai_models (
  name,
  display_name,
  provider,
  description,
  type,
  is_default,
  is_enabled,
  sort_order,
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
  usage_scope = EXCLUDED.usage_scope,
  is_visible_in_selector = EXCLUDED.is_visible_in_selector,
  agent_role = EXCLUDED.agent_role,
  supports_tool_calling = EXCLUDED.supports_tool_calling;


-- ============================================================================
-- Table: image_tool_prompts
-- Project-level prompts for image tools
-- ============================================================================
CREATE TABLE image_tool_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool TEXT NOT NULL CHECK (tool IN ('removeBackground', 'upscale', 'erase', 'expand')),
  prompt TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_image_tool_prompts_project_tool ON image_tool_prompts(project_id, tool, is_enabled);

ALTER TABLE image_tool_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can read image tool prompts"
  ON image_tool_prompts FOR SELECT
  USING (true);
