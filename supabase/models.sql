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
  sort_order INTEGER DEFAULT 0,        -- Display order
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for enabled models
CREATE INDEX idx_ai_models_enabled ON ai_models(is_enabled, sort_order);

-- Index for model type queries
CREATE INDEX idx_ai_models_type ON ai_models(type, is_enabled);

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
INSERT INTO ai_models (name, display_name, provider, description, type, is_default, sort_order) VALUES
  ('doubao-seedream-4-5-251128', '豆包 Seedream', 'volcengine', '火山引擎图像生成模型', 'image', true, 1);

-- Gemini image model (Nano Banana Pro)
-- Requirements: 5.1, 6.2, 6.6, 7.1
INSERT INTO ai_models (name, display_name, provider, description, type, is_default, is_enabled, sort_order) VALUES
  ('gemini-3-pro-image-preview', 'Nano Banana Pro', 'google', 'Google Gemini 专业图像生成，支持 4K 输出', 'image', false, true, 2)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider = EXCLUDED.provider,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_enabled = EXCLUDED.is_enabled;
