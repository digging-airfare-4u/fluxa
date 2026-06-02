/**
 * Shared Model Default Constants
 * Single source of truth for all fallback model name strings.
 * Runtime overrides go through `system_settings` table — these are compile-time fallbacks only.
 */

/** Default chat/vision model for single-turn (generate-ops) and multi-turn (agent brain fallback) */
export const DEFAULT_CHAT_MODEL = 'doubao-seed-1-6-vision-250815';

/** Default image generation model for generate-image and image-tools */
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

/** Default image generation model for agent tool calls */
export const DEFAULT_AGENT_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/** Default Volcengine image editing model (used by registry-setup, factory, validators) */
export const DEFAULT_VOLCENGINE_IMAGE_MODEL = 'doubao-seedream-4-5-251128';

/** Built-in Kimi (Moonshot) chat/brain model. Served via Kimi's Anthropic-compatible endpoint. */
export const DEFAULT_KIMI_MODEL = 'kimi-k2-0905-preview';

/** Default API base for the built-in Kimi provider (Anthropic-compatible coding endpoint). */
export const DEFAULT_KIMI_API_URL = 'https://api.kimi.com/coding';
