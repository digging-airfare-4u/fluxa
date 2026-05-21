-- OpenAI Image API URL configuration
-- Stores the full endpoint URL (including path). No suffix is appended by code.
-- Defaults to official OpenAI Images API endpoint when not configured.

INSERT INTO system_settings (key, value, description)
VALUES (
  'openai_image_api_url',
  '{"url": "https://api.openai.com/v1/images/generations"}'::jsonb,
  'OpenAI image generation full endpoint URL. Override to use a proxy (e.g. https://cdn.12ai.org/v1/chat/completions).'
)
ON CONFLICT (key) DO NOTHING;
