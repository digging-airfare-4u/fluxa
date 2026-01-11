-- AI Models Configuration
-- Stores available AI models for image generation

-- ============================================================================
-- Table: ai_models
-- Available AI models for generation (configured via database)
-- ============================================================================
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- Internal name (e.g., 'doubao-seedream-4-5-251128')
  display_name TEXT NOT NULL,          -- Display name (e.g., '豆包 Seedream')
  provider TEXT NOT NULL,              -- Provider (e.g., 'volcengine')
  description TEXT,                    -- Short description
  is_default BOOLEAN DEFAULT FALSE,    -- Default model for new conversations
  is_enabled BOOLEAN DEFAULT TRUE,     -- Whether model is available
  sort_order INTEGER DEFAULT 0,        -- Display order
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for enabled models
CREATE INDEX idx_ai_models_enabled ON ai_models(is_enabled, sort_order);

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
INSERT INTO ai_models (name, display_name, provider, description, is_default, sort_order) VALUES
  ('doubao-seedream-4-5-251128', '豆包 Seedream', 'volcengine', '火山引擎图像生成模型', true, 1);
