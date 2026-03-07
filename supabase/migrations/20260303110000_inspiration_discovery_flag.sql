-- Inspiration Discovery rollout flag (default OFF)
-- Safe rollout: enable per-user via allow_user_ids before global enable.

BEGIN;

INSERT INTO system_settings (key, value, description)
VALUES (
  'inspiration_discovery_enabled',
  '{"enabled": false, "allow_user_ids": []}'::jsonb,
  'Inspiration discovery feature flag. enabled=false keeps feature off; allow_user_ids supports phased rollout.'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
