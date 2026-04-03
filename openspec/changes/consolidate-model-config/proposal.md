## Why

Model default values and provider configuration are scattered across hardcoded constants in 4+ edge functions, 3 overlapping environment variables, and a `system_settings` database table — with no single source of truth. This makes it error-prone to change defaults (must update multiple files) and confusing to reason about which config layer wins at runtime.

## What Changes

- **Create `_shared/defaults.ts`** as the single source of truth for all hardcoded fallback model names (`DEFAULT_CHAT_MODEL`, `DEFAULT_IMAGE_MODEL`, `DEFAULT_AGENT_IMAGE_MODEL`, `DEFAULT_VOLCENGINE_IMAGE_MODEL`)
- **BREAKING**: Remove all model-selection environment variables (`AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, `DEFAULT_AI_MODEL`) — all model name overrides go through `system_settings` database table
- **Consolidate Gemini env vars**: remove `GEMINI_IMAGE_API_MODE`, `GEMINI_IMAGE_API_URL`, `GEMINI_IMAGE_API_KEY` if OpenAI-compat mode is unused, or move them into a structured `system_settings` row if both modes are needed
- **Unify default model resolution** across `generate-ops`, `generate-image`, `image-tools`, and `agent` to follow the same pattern: `system_settings` table (runtime-mutable) → hardcoded fallback from `_shared/defaults.ts` (no env vars in the chain)
- **Add `default_chat_model` and `default_image_model` keys to `system_settings`** so all model defaults are runtime-configurable
- **Agent brain model chains to `default_chat_model`**: `agent_default_brain_model` → `default_chat_model` → constant, so admin only needs to update one key for global defaults
- **Admin UI for model defaults**: Add "默认模型" section to existing `ProviderConfigPanel`, exposing `default_chat_model`, `default_image_model`, and `agent_default_brain_model` as editable fields for super-admins

## Capabilities

### New Capabilities
- `model-defaults-resolution`: Defines the unified fallback chain and single-source-of-truth constants for all model default resolution across edge functions

### Modified Capabilities
- `model-config-settings`: Add requirement that system model defaults are resolved through `system_settings` table with consistent fallback chain, not per-function hardcoded values or env vars

## Impact

- **Edge functions**: `agent/index.ts`, `generate-ops/index.ts`, `generate-image/index.ts`, `image-tools/index.ts` — all change how they resolve default models
- **Shared providers**: `_shared/providers/registry-setup.ts`, `_shared/providers/volcengine.ts`, `_shared/providers/gemini.ts`, `_shared/providers/factory.ts` — remove scattered env var reads and hardcoded strings; `validators/request.ts` also updated
- **Environment variables**: `AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, and `DEFAULT_AI_MODEL` removed from model selection; Gemini image vars consolidated
- **Frontend**: `ProviderConfigPanel` gains a new "默认模型" section; new API route `/api/system-settings/model-defaults`; new client functions in `provider-configs.ts`
- **Database**: New `system_settings` keys `default_chat_model` and `default_image_model`; existing `agent_default_brain_model` and `gemini_api_host` unchanged
- **Deployment**: Teams must set `default_chat_model` in `system_settings` (if previously relying on `DEFAULT_AI_MODEL` env var) and remove deprecated env vars from Supabase Edge Function secrets after migration
