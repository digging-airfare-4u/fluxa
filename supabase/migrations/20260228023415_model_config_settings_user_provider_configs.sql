-- User Provider Configurations (BYOK)
-- Requirements: 1.1, 1.2, 2.2, 2.3, 2.4, 2.5

-- ============================================================================
-- Table: user_provider_configs
-- Stores user-owned external provider credentials/configs for image generation.
-- API keys are stored encrypted in `api_key_encrypted`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('volcengine', 'openai-compatible')),
  api_key_encrypted TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL DEFAULT '',
  api_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_provider_configs_api_url_not_empty CHECK (length(trim(api_url)) > 0),
  CONSTRAINT user_provider_configs_model_name_not_empty CHECK (length(trim(model_name)) > 0),
  CONSTRAINT user_provider_configs_display_name_not_empty CHECK (length(trim(display_name)) > 0),
  CONSTRAINT user_provider_configs_last4_length CHECK (char_length(api_key_last4) <= 4)
);

-- Backward-compatible additive changes (safe re-run)
ALTER TABLE user_provider_configs
  ADD COLUMN IF NOT EXISTS api_key_last4 TEXT NOT NULL DEFAULT '';

ALTER TABLE user_provider_configs
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_provider_configs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE user_provider_configs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_provider_configs_user_id
  ON user_provider_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_provider_configs_user_provider
  ON user_provider_configs(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_provider_configs_user_enabled
  ON user_provider_configs(user_id, is_enabled);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_configs_user_model_unique
  ON user_provider_configs(user_id, model_name);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS update_user_provider_configs_updated_at ON user_provider_configs;
CREATE TRIGGER update_user_provider_configs_updated_at
  BEFORE UPDATE ON user_provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE user_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own provider configs" ON user_provider_configs;
CREATE POLICY "Users can view own provider configs"
  ON user_provider_configs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own provider configs" ON user_provider_configs;
CREATE POLICY "Users can create own provider configs"
  ON user_provider_configs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own provider configs" ON user_provider_configs;
CREATE POLICY "Users can update own provider configs"
  ON user_provider_configs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own provider configs" ON user_provider_configs;
CREATE POLICY "Users can delete own provider configs"
  ON user_provider_configs FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Safe View: user_provider_configs_safe
-- Exposes masked key only and never exposes plaintext/encrypted key.
-- ============================================================================

CREATE OR REPLACE VIEW user_provider_configs_safe AS
SELECT
  id,
  user_id,
  provider,
  api_url,
  model_name,
  display_name,
  is_enabled,
  created_at,
  updated_at,
  CASE
    WHEN api_key_last4 IS NULL OR api_key_last4 = '' THEN '****'
    ELSE '****' || api_key_last4
  END AS api_key_masked
FROM user_provider_configs;

GRANT SELECT ON user_provider_configs_safe TO authenticated;
