-- Add GPT Image 2 (OpenAI) image generation model
-- Based on OpenAI API endpoint, provides high-quality image generation

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
  'gpt-image-2',
  'GPT Image 2',
  'openai',
  'OpenAI GPT Image 2 图像生成模型',
  'image',
  false,
  true,
  3,
  true,
  'classic',
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
  supports_image_tool = EXCLUDED.supports_image_tool,
  usage_scope = EXCLUDED.usage_scope,
  is_visible_in_selector = EXCLUDED.is_visible_in_selector,
  agent_role = EXCLUDED.agent_role,
  supports_tool_calling = EXCLUDED.supports_tool_calling;
