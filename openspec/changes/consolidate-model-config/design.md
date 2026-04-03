## Context

Model default resolution is currently spread across three layers with no consistent pattern:

| Edge function | Current resolution |
|---|---|
| `generate-ops` | `body.model` → `Deno.env.get('DEFAULT_AI_MODEL')` → `'doubao-seed-1-6-vision-250815'` (inline) |
| `agent` | `system_settings.agent_default_brain_model` → `AGENT_RUNTIME_MODEL` env → `DEFAULT_AI_MODEL` env → inline string |
| `generate-image` | `body.model` → `'gemini-2.5-flash-image'` (inline constant); does NOT query `system_settings` |
| `image-tools` | `resolveImageToolModel()` queries `ai_models` table (`supports_image_tool && is_enabled`) → `'gemini-2.5-flash-image'` inline fallback; separately `ProviderFactory.getDefaultProvider()` → `new VolcengineProvider()` (no param) → `VOLCENGINE_IMAGE_MODEL` env var fallback |

There are **two separate image provider systems** in the codebase:

- **`registry-setup.ts` + `createRegistry()`** — used by `generate-image`. Passes explicit model names; `VOLCENGINE_IMAGE_MODEL` is **not used** here.
- **`ProviderFactory` (factory.ts)** — used by `image-tools`. Its `getDefaultProvider()` calls `new VolcengineProvider()` **without arguments**, so `VOLCENGINE_IMAGE_MODEL` env var IS read as fallback in that path.

This means `VOLCENGINE_IMAGE_MODEL` is not dead code — it is live for `image-tools` but redundant for `generate-image` (which always passes explicit names through registry). Both paths should be unified to use the same constant.

Gemini has two API modes (`native` and `openai`). The effective default is `'native'` because `registry-setup.ts` passes `mode: 'native'` explicitly. The `GeminiProvider.resolveMode()` method (which defaults to `'openai'`) is never called in the registry-setup path since a mode is always provided. The inconsistency is in the code organization, not the runtime behavior.

## Goals / Non-Goals

**Goals:**
- Single file (`_shared/defaults.ts`) owns all fallback model name strings
- All edge functions follow the same resolution pattern: DB (`system_settings`) → hardcoded constant (zero env vars in the model selection chain)
- Remove all model-selection env vars (`AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, `DEFAULT_AI_MODEL` for model selection)
- Consolidate Gemini dual-mode config into a coherent single path
- Add `default_image_model` to `system_settings` for runtime flexibility

**Non-Goals:**
- Changing the BYOK user-provider flow (unrelated)
- Migrating existing `system_settings` keys (`agent_default_brain_model`, `gemini_api_host`)
- Adding admin UI for editing `default_chat_model` / `default_image_model` (can follow later)
- Changing the `ai_models` database table or frontend `SelectableModel` logic
- Merging the two parallel provider systems (`ProviderRegistry` used by `generate-image` vs `ProviderFactory` used by `image-tools`) — this is a larger refactor best done as a follow-up

## Decisions

### 1. Create `_shared/defaults.ts` as single source of truth

```ts
export const DEFAULT_CHAT_MODEL = 'doubao-seed-1-6-vision-250815';
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const DEFAULT_AGENT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const DEFAULT_VOLCENGINE_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
```

**Why not env vars?** Model names are code-level knowledge tied to the registry. Env vars add indirection without value — runtime overrides belong in `system_settings`.

### 2. Extract a shared `resolveDefaultModel()` helper

Create `_shared/utils/resolve-default-model.ts`:

```ts
async function resolveDefaultModel(
  serviceClient: SupabaseClient,
  settingsKey: string,
  fallback: string | null,
): Promise<string | null>
```

Logic: query `system_settings` by key → extract `value.model` → fallback to provided constant (or `null` if fallback is `null`). All edge functions call this instead of implementing their own lookup.

For chat model resolution, the caller passes `settingsKey = 'default_chat_model'` and `fallback = DEFAULT_CHAT_MODEL`. For image model resolution: `settingsKey = 'default_image_model'` and `fallback = DEFAULT_IMAGE_MODEL`. No env vars participate in the fallback chain — `system_settings` is the only runtime override, hardcoded constants are the only compile-time fallback.

Agent brain resolution is a special case: it calls `resolveDefaultModel` twice in a chain — first with `'agent_default_brain_model'` and `fallback = null`, and if that returns `null`, falls through to `resolveDefaultModel('default_chat_model', DEFAULT_CHAT_MODEL)` (see Decision 3). This lets admins set one global default while still allowing agent-specific overrides.

**Important safety constraint:** When the resolved default is passed to `resolveSystemImageGenerationProvider` or `resolveChatProvider` as `defaultModel` / `fallbackModel`, callers must always use the **hardcoded constant** (not the DB-resolved value) as the ultimate fallback in those functions. This prevents a mis-typed `system_settings` value from cascading into a provider lookup failure. The DB value is used as `selectedModel`; the hardcoded constant is the safety net.

**Why a shared helper?** The agent already has this exact pattern (`resolveDefaultAgentRuntimeModel`). Extracting it eliminates 3 inline implementations and ensures all functions — including `generate-image` and `image-tools` — go through the same `system_settings` lookup for image model defaults.

### 3. Remove `AGENT_RUNTIME_MODEL` env var and chain agent brain to `default_chat_model`

The `agent_default_brain_model` DB key already provides runtime override capability. The env var is a redundant middle layer. The new fallback chain is:

`system_settings(agent_default_brain_model)` → `system_settings(default_chat_model)` → `DEFAULT_CHAT_MODEL` constant.

**Why chain to `default_chat_model`?** In most deployments, agent and single-turn chat use the same model. By falling back to `default_chat_model` before env/constant, an admin only needs to update **one** `system_settings` key to change the global default for both single-turn and multi-turn. When agent needs a different (e.g. stronger reasoning) model, `agent_default_brain_model` still takes precedence.

**Alternative considered:** Keep `AGENT_RUNTIME_MODEL` as agent-specific env override. Rejected because `system_settings` already fulfills this role and is changeable without redeployment.

### 4. Remove `DEFAULT_AI_MODEL` env var from model selection

`DEFAULT_AI_MODEL` is currently used by `generate-ops` and `agent` as a middle fallback. With `system_settings.default_chat_model` providing the same runtime override capability, the env var is redundant for model selection. Remove all `Deno.env.get('DEFAULT_AI_MODEL')` reads from model resolution paths.

**Note:** `DEFAULT_AI_MODEL` may still be referenced elsewhere (e.g. in documentation or non-model contexts). This change only removes it from the model resolution chain. If no other usages remain, the env var itself can be deleted from Supabase secrets.

### 5. Consolidate `VOLCENGINE_IMAGE_MODEL` env var

`VOLCENGINE_IMAGE_MODEL` is live code for `image-tools` (via `ProviderFactory.getDefaultProvider()`) but redundant for `generate-image` (which always passes explicit names through registry). Remove the env var read from `VolcengineProvider` constructor and instead have the factory (`factory.ts`) and registry (`registry-setup.ts`) both use an explicit constant. The env var's purpose (runtime override of the default Volcengine image model) is better served by `system_settings.default_image_model` once that key is added.

### 6. Clean up Gemini dual-mode configuration

Both modes are actively used: `native` for direct Gemini API, `openai` for OpenRouter proxying. The runtime behavior is already correct (effective default is `'native'`). The cleanup is purely code organization:

- **Remove `GEMINI_IMAGE_API_MODE` from `registry-setup.ts`** — it passes `mode: 'native'` always (because of `|| 'native'`), so reading the env var here is redundant. Remove the env var read and always pass `'native'` explicitly (or remove the `mode` parameter entirely and let `GeminiProvider` resolve it internally).
- **`GeminiProvider.resolveMode()`** — currently defaults to `'openai'` but is never called from `registry-setup` path. Flip its default to `'native'` for consistency and to serve as a correct fallback if other callers omit the mode.
- **Keep `GEMINI_IMAGE_API_URL` and `GEMINI_IMAGE_API_KEY`** — these are infrastructure config (endpoint + credential) appropriate for env vars, not model selection. They only apply when mode is `'openai'`.

### 7. Add `default_chat_model` and `default_image_model` to system_settings

New `system_settings` rows with `value: { model: string }` format, matching existing `agent_default_brain_model` pattern. No migration needed — `resolveDefaultModel()` falls through gracefully when the key doesn't exist.

### 8. Add admin UI for model defaults in ProviderConfigPanel

Currently `agent_default_brain_model` is set implicitly when saving an Anthropic-Compatible config (`ProviderConfigPanel.tsx:270-274`) with no explicit UI. All three model default settings should be exposed in the existing `ProviderConfigPanel` as a new "默认模型" section visible only to super-admins (`canManage === true`).

**UI design:**
- Add a new `ProviderSection` at the top of the list view titled "默认模型" with description "全局模型默认配置"
- Three inline-editable fields (or select dropdowns if model list is available):
  - **默认聊天模型** (`default_chat_model`) — affects generate-ops and agent brain (as fallback)
  - **默认图片模型** (`default_image_model`) — affects generate-image, image-tools, and agent image generation
  - **Agent Brain 模型** (`agent_default_brain_model`) — agent-specific override, shows "(跟随默认聊天模型)" when unset
- Each field shows current value from `system_settings`, editable with save button
- Empty/unset state clearly indicates "使用系统默认值" with the hardcoded constant shown as hint

**API changes:**
- Create `GET/POST /api/system-settings/model-defaults` route — returns all three keys in one call, accepts partial updates
- Reuse existing `agent-default-brain` route logic, generalized to handle multiple keys
- Frontend: add `fetchModelDefaults()` and `updateModelDefaults()` to `provider-configs.ts`

**Why in ProviderConfigPanel?** Admin configures providers and model defaults in the same mental flow — "which providers are available" and "which model is the default" are related decisions. Separate pages would fragment the admin workflow.

## Risks / Trade-offs

**[Breaking] `AGENT_RUNTIME_MODEL` removal** → Any deployment relying on this env var will silently ignore it. Mitigation: document in deployment notes; the `system_settings` row is the intended replacement and already works.

**[Breaking] `DEFAULT_AI_MODEL` env var no longer used for model selection** → Deployments that relied on this env var to override the default chat model must migrate to `system_settings.default_chat_model`. Mitigation: one-time DB insert before deploying.

**[Breaking] `VOLCENGINE_IMAGE_MODEL` removal** → `image-tools` previously used this as a runtime override path. After removal, `image-tools` falls back to the same hardcoded constant as `generate-image`. Mitigation: `system_settings.default_image_model` (added in Decision 7) provides the correct override mechanism going forward.

**[Low risk] Gemini mode cleanup** → Runtime behavior is unchanged (was already `'native'` effectively). Code change only. No breaking risk.

**[Latency] DB lookup on every request for defaults** → `system_settings` query adds ~5ms. Mitigation: acceptable for non-streaming cold path; can add in-memory TTL cache later if needed.

## Migration Plan

1. Deploy `_shared/defaults.ts` and `resolve-default-model.ts` — no behavioral change yet
2. Update `factory.ts` to use `DEFAULT_VOLCENGINE_IMAGE_MODEL` from `_shared/defaults.ts` instead of calling `new VolcengineProvider()` with no args (replaces the `VOLCENGINE_IMAGE_MODEL` env var path for `image-tools`)
3. Update `validators/request.ts` to import from `_shared/defaults.ts` instead of inline constant
4. Update each edge function to use the shared helper for chat model resolution — behavioral change only if `AGENT_RUNTIME_MODEL` was set (unlikely given `system_settings` already works)
5. Update `VolcengineProvider` constructor: remove env var read, require explicit `modelName` parameter
6. Clean up Gemini `registry-setup.ts` mode handling and fix `resolveMode()` default
7. After deploy: remove `AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, and `DEFAULT_AI_MODEL` (if no other usages) from Supabase Edge Function secrets

**Rollback:** Revert to previous edge function bundle. No DB migration to undo.

## Open Questions

- Should we add a TTL cache for `system_settings` lookups to avoid per-request DB hits? (Suggest: defer, measure first)
- Should `image-tools`'s `resolveImageToolModel()` (`ai_models` table query) be kept as a higher-priority source before `system_settings`, or replaced entirely by `system_settings.default_image_model`? Current decision: keep `ai_models` query but use `system_settings.default_image_model` as the fallback instead of an inline constant
- Should `ProviderRegistry` and `ProviderFactory` be merged into a single provider system? (Suggest: follow-up change — this change only ensures they use the same constants)
- `types.ts` 中的 `GEMINI_MODELS` / `VOLCENGINE_MODELS` 能力配置与模型名强耦合 — admin 通过 `system_settings` 设置了未在这些 map 中注册的模型会导致 provider 匹配失败。短期方案：admin UI 做校验，只允许选择已注册的模型名；长期方案：模型能力配置也从 DB 驱动

## Decided — Out of Scope (follow-up changes)

- **API URLs 迁移到 `system_settings`**: API base URLs (如 `gemini_api_host` 模式已有先例，`VOLCENGINE_API_URL` 等) 后续统一迁入 DB，本次不动
- **API Keys 保留 env var**: 秘钥保持环境变量存储，不迁入 DB（安全隔离 + DB 故障时仍可用）
- **模型注册表动态化**: `registry-setup.ts` 中的 chat 模型列表 (`gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`, `claude-3-haiku`, `claude-3-sonnet`) 和图片模型列表目前硬编码在代码里，决定了系统支持哪些模型。后续应从 DB（如 `ai_models` 表）驱动注册，让 admin 可以动态添加/移除可用模型
- **行为配置 env var 迁移**: `GEMINI_INLINE_REFERENCE_MAX_BYTES`（参考图内联最大字节数）等行为配置 env var 后续可迁入 `system_settings`，本次不动
