-- Model Config Settings: defaults and rollout flags
-- Requirements: 3.2-3.6, 8.4

BEGIN;

-- Ensure Gemini is the unique default image model.
UPDATE ai_models
SET is_default = false
WHERE type = 'image';

UPDATE ai_models
SET is_default = true
WHERE type = 'image'
  AND name = 'gemini-3-pro-image-preview';

DO $$
DECLARE
  default_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO default_count
  FROM ai_models
  WHERE type = 'image' AND is_default = true;

  IF default_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one default image model, got %', default_count;
  END IF;
END;
$$;

-- Feature flag (default OFF, can be enabled by ops in phased rollout).
INSERT INTO system_settings (key, value, description)
VALUES (
  'model_config_enabled',
  '{"enabled": false}'::jsonb,
  'Model config settings feature flag. false=disabled, true=enabled'
)
ON CONFLICT (key) DO NOTHING;

-- Provider host allowlist source (empty by default -> fail-closed until configured).
INSERT INTO system_settings (key, value, description)
VALUES (
  'provider_host_allowlist',
  '{"hosts": []}'::jsonb,
  'Allowed provider host:port list for BYOK endpoint egress control'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
