-- Allow anthropic-compatible shared provider configs for Agent Brain.

ALTER TABLE user_provider_configs
  DROP CONSTRAINT IF EXISTS user_provider_configs_provider_check;

ALTER TABLE user_provider_configs
  ADD CONSTRAINT user_provider_configs_provider_check
  CHECK (provider IN ('volcengine', 'openai-compatible', 'anthropic-compatible'));
