## 1. Shared defaults module

- [x] 1.1 Create `supabase/functions/_shared/defaults.ts` exporting: `DEFAULT_CHAT_MODEL` (`'doubao-seed-1-6-vision-250815'`), `DEFAULT_IMAGE_MODEL` (`'gemini-2.5-flash-image'`), `DEFAULT_AGENT_IMAGE_MODEL` (`'gemini-3-pro-image-preview'`), and `DEFAULT_VOLCENGINE_IMAGE_MODEL` (`'doubao-seedream-4-5-251128'`)
- [x] 1.2 Create `supabase/functions/_shared/utils/resolve-default-model.ts` with shared `resolveDefaultModel(serviceClient, settingsKey, fallback: string | null): Promise<string | null>` helper that queries `system_settings` table and falls through to the provided fallback (no env var in the chain). When fallback is `null` and DB key is missing, returns `null`.

## 2. Update generate-ops

- [x] 2.1 In `supabase/functions/generate-ops/index.ts`, replace inline `Deno.env.get('DEFAULT_AI_MODEL') || 'doubao-seed-1-6-vision-250815'` with `await resolveDefaultModel(serviceClient, 'default_chat_model', DEFAULT_CHAT_MODEL)`. Use the resolved value as `selectedModel`, but pass `DEFAULT_CHAT_MODEL` (hardcoded constant) as `fallbackModel` to `resolveChatProvider` — the hardcoded constant is the safety net if the DB value is an unregistered model.

## 3. Update agent

- [x] 3.1 In `supabase/functions/agent/index.ts`, remove `AGENT_RUNTIME_MODEL` and `DEFAULT_AI_MODEL` env var reads from `DEFAULT_AGENT_RUNTIME_MODEL` constant. Remove the entire `DEFAULT_AGENT_RUNTIME_MODEL` constant.
- [x] 3.2 Replace `resolveDefaultAgentRuntimeModel()` inline function with two-level DB fallback: `await resolveDefaultModel(serviceClient, 'agent_default_brain_model', null)` → if null, `await resolveDefaultModel(serviceClient, 'default_chat_model', DEFAULT_CHAT_MODEL)`. Pass `DEFAULT_CHAT_MODEL` (hardcoded) as `fallbackModel` to `resolveChatProvider` — the DB-resolved value is used as `selectedModel`, the constant is the safety net.
- [x] 3.3 Replace hardcoded `DEFAULT_AGENT_IMAGE_MODEL = 'gemini-3-pro-image-preview'` with import from `_shared/defaults.ts`
- [x] 3.4 Update agent image model resolution: resolve via `await resolveDefaultModel(serviceClient, 'default_image_model', DEFAULT_AGENT_IMAGE_MODEL)`, use result as `selectedModel` in `resolveAgentImageProvider`. Pass `DEFAULT_AGENT_IMAGE_MODEL` (hardcoded) as `defaultModel` param — the constant is the safety net for `resolveSystemImageGenerationProvider`.

## 4. Update generate-image

- [x] 4.1 In `supabase/functions/generate-image/index.ts`, replace `const DEFAULT_MODEL = 'gemini-2.5-flash-image'` with import of `DEFAULT_IMAGE_MODEL` from `_shared/defaults.ts`
- [x] 4.2 Add `system_settings` lookup: resolve default via `await resolveDefaultModel(serviceClient, 'default_image_model', DEFAULT_IMAGE_MODEL)`, use as `selectedModel`. Pass `DEFAULT_IMAGE_MODEL` (hardcoded constant) as `defaultModel` to `resolveSystemImageGenerationProvider` — the constant is the safety net if the DB value is an unregistered model.

## 5. Update image-tools

- [x] 5.1 In `supabase/functions/image-tools/index.ts`, replace `const DEFAULT_MODEL = 'gemini-2.5-flash-image'` with import of `DEFAULT_IMAGE_MODEL` from `_shared/defaults.ts`
- [x] 5.2 Update `resolveImageToolModel()` fallback: instead of falling back to inline constant, fall back to `await resolveDefaultModel(serviceClient, 'default_image_model', DEFAULT_IMAGE_MODEL)` — keep `ai_models` table query as higher-priority source

## 6. Clean up VolcengineProvider

- [x] 6.1 In `supabase/functions/_shared/providers/volcengine.ts`, remove `VOLCENGINE_IMAGE_MODEL` env var read from constructor — make `modelName` parameter required (it is always passed from registry-setup and factory)

## 7. Fix Gemini config inconsistency

- [x] 7.1 In `supabase/functions/_shared/providers/registry-setup.ts`, remove the `GEMINI_IMAGE_API_MODE` env var read — stop passing `mode` to `GeminiProvider` constructor (let the provider resolve its own mode internally)
- [x] 7.2 In `supabase/functions/_shared/providers/gemini.ts`, fix `resolveMode()` default from `'openai'` to `'native'` so it matches the intended behavior. Note: this also affects `ProviderFactory`'s Gemini path which uses the legacy two-arg constructor → `resolveMode()`. Verify this is the intended behavior (it is — native mode is what we actually use).

## 8. Update registry-setup to use shared constants

- [x] 8.1 In `supabase/functions/_shared/providers/registry-setup.ts`, replace hardcoded `'doubao-seed-1-6-vision-250815'` with `DEFAULT_CHAT_MODEL` import
- [x] 8.2 Replace hardcoded `'doubao-seedream-4-5-251128'` with `DEFAULT_VOLCENGINE_IMAGE_MODEL` import from `_shared/defaults.ts`

## 9. Update ProviderFactory (factory.ts) — separate provider system used by image-tools

- [x] 9.1 In `supabase/functions/_shared/providers/factory.ts`, replace hardcoded `'doubao-seedream-4-5-251128'` in `providerFactories` map with `DEFAULT_VOLCENGINE_IMAGE_MODEL` import
- [x] 9.2 In `factory.ts`, update `getDefaultProvider()` to pass `DEFAULT_VOLCENGINE_IMAGE_MODEL` explicitly to `VolcengineProvider()` instead of calling with no arguments — eliminates reliance on `VOLCENGINE_IMAGE_MODEL` env var

## 10. Update RequestValidator (validators/request.ts)

- [x] 10.1 In `supabase/functions/_shared/validators/request.ts`, replace `RequestValidator.DEFAULT_MODEL = 'doubao-seedream-4-5-251128'` with import of `DEFAULT_VOLCENGINE_IMAGE_MODEL` from `_shared/defaults.ts`

## 11. API route for model defaults

- [x] 11.1 Create `src/app/api/system-settings/model-defaults/route.ts` with GET and POST handlers
  - GET: returns `{ default_chat_model, default_image_model, agent_default_brain_model }` from `system_settings` (null for unset keys)
  - POST: accepts partial `{ default_chat_model?, default_image_model?, agent_default_brain_model? }`, upserts each provided key
  - Both require super-admin auth (reuse `getUserAdminFlags` pattern from `agent-default-brain/route.ts`)

## 12. Frontend: model defaults in ProviderConfigPanel

- [x] 12.1 Add `fetchModelDefaults()` and `updateModelDefaults()` to `src/lib/api/provider-configs.ts` — calls GET/POST `/api/system-settings/model-defaults`
- [x] 12.2 Add "默认模型" `ProviderSection` at the top of `ProviderConfigPanel` list view (only visible when `canManage === true`)
  - Three fields: 默认聊天模型 (`default_chat_model`), 默认图片模型 (`default_image_model`), Agent Brain 模型 (`agent_default_brain_model`)
  - Each shows current value, editable inline with save button
  - Unset state shows hint text: "使用系统默认值 (xxx)" where xxx is the hardcoded constant from `_shared/defaults.ts`
  - Agent Brain 模型 unset state shows: "跟随默认聊天模型"
- [x] 12.3 Remove implicit `updateAgentDefaultBrain()` call from Anthropic-Compatible config save (`ProviderConfigPanel.tsx:270-274`) — agent brain model is now explicitly configured in the 默认模型 section
- [x] 12.4 Add `src/lib/supabase/queries/settings.ts` functions: `getDefaultChatModel()` and `getDefaultImageModel()` (following existing `getAgentDefaultBrainModel()` pattern)

## 13. Clean up dead code

- [x] 13.1 Delete `src/app/api/system-settings/agent-default-brain/route.ts` — replaced by the generalized `model-defaults` route
- [x] 13.2 Remove `updateAgentDefaultBrain()` and `UpdateAgentDefaultBrainInput` from `src/lib/api/provider-configs.ts` — no longer called anywhere
- [x] 13.3 Remove `getAgentDefaultBrainModel()` from `src/lib/supabase/queries/settings.ts` if no other callers remain — replaced by `fetchModelDefaults()` (KEPT: still used by ChatPanel.tsx)

## 14. Verification

- [x] 14.1 Search codebase for any remaining inline occurrences of `doubao-seed-1-6-vision-250815`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, `doubao-seedream-4-5-251128` outside of `_shared/defaults.ts` — only in SQL migrations, types.ts (model union), and frontend constants (expected)
- [x] 14.2 Search for `AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, and `DEFAULT_AI_MODEL` in model resolution paths — confirmed zero env var reads remain, only constant name references
- [x] 14.3 Verify `image-tools` still resolves to Volcengine as default (since `ProviderFactory.getDefaultProvider()` still returns Volcengine, just with explicit model name)
- [ ] 14.4 Deploy edge functions and verify generate-ops, generate-image, image-tools, and agent all resolve defaults correctly (manual)
- [ ] 14.5 Verify that setting `default_chat_model` in `system_settings` affects both generate-ops and agent brain model (manual)
- [ ] 14.6 Verify that setting `default_image_model` in `system_settings` affects generate-image, image-tools, and agent image generation (manual)
- [ ] 14.7 Verify ProviderConfigPanel shows "默认模型" section for super-admins, hides for regular users (manual)
- [ ] 14.8 Verify editing model defaults in UI correctly updates `system_settings` and is reflected in subsequent edge function requests (manual)
- [ ] 14.9 Verify that a mis-typed model in `system_settings` does not crash — the hardcoded constant safety net in `resolveSystemImageGenerationProvider` / `resolveChatProvider` should catch it (manual)
