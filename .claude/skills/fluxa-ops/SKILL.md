---
name: fluxa-ops
description: Unified operational toolkit for Fluxa — debug edge functions, deploy, manage models, tune agent prompts. Use `/fluxa:<sub>` to enter a specific workflow.
license: MIT
metadata:
  author: fluxa
  version: "1.0"
---

# Fluxa Ops

Unified operational skill for the Fluxa project. Routes to sub-workflows based on the command used.

**Sub-commands:**

| Command | Workflow |
|---------|----------|
| `/fluxa:debug` | Debug edge function / API errors |
| `/fluxa:deploy` | Deploy Supabase Edge Functions |
| `/fluxa:model` | Manage AI model configurations |
| `/fluxa:agent` | Tune Agent planner/executor prompts |

---

## Project Context

**Stack:** Next.js frontend + Supabase Edge Functions (Deno) + Supabase Postgres

**Key tables:**
- `system_settings` — runtime config (model defaults, API hosts, feature flags). Schema: `{ key: string, value: jsonb }`
- `ai_models` — model registry displayed in frontend. Key columns: `name`, `display_name`, `type` ('image'|'chat'|'ops'), `is_enabled`, `is_default`, `is_visible_in_selector`
- `provider_configs` — user-configured (BYOK) providers

**Key paths:**
- Edge functions: `supabase/functions/<name>/index.ts`
- Shared modules: `supabase/functions/_shared/`
- Provider registry: `supabase/functions/_shared/providers/registry-setup.ts`
- Model defaults: `supabase/functions/_shared/defaults.ts`
- Default model resolver: `supabase/functions/_shared/utils/resolve-default-model.ts`
- Agent orchestrator: `supabase/functions/_shared/utils/agent-orchestrator.ts`
- Frontend model selector: `src/components/chat/ModelSelector.tsx`
- Frontend model resolver: `src/lib/models/resolve-selectable-models.ts`
- Frontend model queries: `src/lib/supabase/queries/models.ts`

**Model resolution chain (example: agent image model):**
```
request.imageModel (frontend)
  → resolveDefaultModel('default_image_model', DEFAULT_AGENT_IMAGE_MODEL)
    → system_settings DB lookup
      → hardcoded fallback in defaults.ts
```

**API host resolution (Gemini):**
```
system_settings 'gemini_api_host' → value.host
  → fallback: https://generativelanguage.googleapis.com
API key: Deno.env.get('GEMINI_API_KEY')
```

---

## Workflow: Debug (`/fluxa:debug`)

Use when: Edge function errors, API 5xx, unexpected behavior.

### Procedure

1. **Identify the failing function** — Ask the user or infer from the error message (agent, generate-image, generate-ops, etc.)

2. **Check edge function logs**
   ```
   Use mcp__supabase__get_logs with service: "edge-function"
   ```
   Look for: non-200 status codes, error patterns, timestamps matching the incident.

3. **Check relevant system_settings**
   ```sql
   SELECT key, value FROM system_settings WHERE key LIKE '%<relevant>%';
   ```
   Common keys: `gemini_api_host`, `default_image_model`, `default_chat_model`, `agent_default_brain_model`, `model_config_enabled`

4. **Trace the code path** — Read the edge function entrypoint, follow the provider/model resolution chain:
   - Which provider class is used? (GeminiProvider, VolcengineProvider, UserConfiguredImageProvider)
   - Where does it get API URL and key? (env vars, system_settings, user config)
   - What model name is resolved?

5. **Determine root cause** — Classify as:
   - **Upstream**: API provider returning errors (503, 429, etc.) — not our code
   - **Configuration**: Wrong host/key/model in system_settings or env vars
   - **Code bug**: Logic error in our edge function

6. **Report findings** — Present a clear table:
   | Item | Value | Source |
   |------|-------|--------|
   | API URL | ... | system_settings / env / hardcoded |
   | API Key | ... | env var name |
   | Model | ... | resolution chain |
   | Error | ... | logs |
   | Root cause | ... | upstream / config / code |

7. **Suggest fix** — If config: offer to update system_settings. If code: propose the change. If upstream: suggest alternatives (different model, different host).

---

## Workflow: Deploy (`/fluxa:deploy`)

Use when: Edge function code has been changed and needs deployment.

### Procedure

1. **Identify which function(s) to deploy** — Check git diff for changes under `supabase/functions/`

2. **Deploy via CLI first** (preferred):
   ```bash
   npx supabase functions deploy <function-name> --no-verify-jwt
   ```
   Use `--no-verify-jwt` only if the function previously had it disabled (agent does).

3. **If CLI fails** (network, Docker not running):
   - Collect all required files (entrypoint + all local imports recursively)
   - Use `mcp__supabase__deploy_edge_function` MCP tool
   - Include all `_shared/` dependencies

4. **Verify deployment**:
   - Check edge function logs for the new version number
   - Confirm the function responds correctly

5. **Commit and push** — Stage the changed files, commit with a descriptive message, push to origin/main.

### Tips
- The agent function has ~30 dependency files in `_shared/` — CLI deploy is strongly preferred
- Always deploy before committing if the change is backend-only (faster feedback)

---

## Workflow: Model (`/fluxa:model`)

Use when: Switching default models, enabling/disabling models, adding new models.

### Procedure

1. **Survey current state**:
   ```sql
   -- All models
   SELECT name, display_name, type, is_default, is_enabled, is_visible_in_selector
   FROM ai_models ORDER BY type, sort_order;

   -- Runtime overrides
   SELECT key, value FROM system_settings WHERE key LIKE '%model%';
   ```

2. **Understand the two-layer config**:
   - `ai_models` table → controls what the **frontend** shows (selector UI)
   - `system_settings` table → controls what the **backend** uses as defaults

   Both must be aligned. Changing only one will cause inconsistency.

3. **To switch the default image model** (example):
   ```sql
   -- Backend: set runtime default
   INSERT INTO system_settings (key, value)
   VALUES ('default_image_model', '{"model": "gemini-2.5-flash-image"}')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

   -- Frontend: enable new model, disable old
   UPDATE ai_models SET is_enabled = true, is_default = true, is_visible_in_selector = true
   WHERE name = 'gemini-2.5-flash-image';

   UPDATE ai_models SET is_enabled = false, is_default = false, is_visible_in_selector = false
   WHERE name = 'gemini-3-pro-image-preview';
   ```

4. **To add a new model**:
   - Insert into `ai_models` with correct `type`, `provider`, `points_cost`
   - Register in `registry-setup.ts` if it's a system model (not BYOK)
   - Update `defaults.ts` if it should be a new default

5. **Verify** — Check both:
   ```sql
   SELECT name, type, is_default, is_enabled FROM ai_models WHERE type = '<type>';
   SELECT key, value FROM system_settings WHERE key = 'default_<type>_model';
   ```

### Key model settings keys
| system_settings key | Controls |
|---|---|
| `default_chat_model` | Default chat/vision model |
| `default_image_model` | Default image generation model |
| `agent_default_brain_model` | Agent's planning/execution brain |
| `gemini_api_host` | Gemini API proxy host |
| `model_config_enabled` | Whether BYOK configs are allowed |

---

## Workflow: Agent (`/fluxa:agent`)

Use when: Tuning agent planner/executor behavior, prompt engineering, tool config.

### Agent Architecture Overview

```
User message
    │
    ▼
┌─────────────────────────────────────────┐
│  Agent Edge Function (agent/index.ts)   │
│                                         │
│  1. Auth + ownership validation         │
│  2. Resolve brain model (chat provider) │
│  3. Deduct points                       │
│  4. Load conversation history           │
│  5. Run agent loop:                     │
│     ┌─────────────────────────────┐     │
│     │ Planner (JSON structured)   │     │
│     │ → plan: steps, mode, flags  │     │
│     └─────────────┬───────────────┘     │
│                   ▼                     │
│     ┌─────────────────────────────┐     │
│     │ Executor (JSON structured)  │     │
│     │ → tool_call or final answer │     │
│     └─────────────┬───────────────┘     │
│                   ▼                     │
│     ┌─────────────────────────────┐     │
│     │ Tool Runner                 │     │
│     │ • web_search                │     │
│     │ • fetch_url                 │     │
│     │ • image_search              │     │
│     │ • generate_image            │     │
│     └─────────────────────────────┘     │
│     (loop up to MAX_ITERATIONS=5)       │
│                                         │
│  6. Save history + persist message      │
│  7. Stream SSE events to frontend       │
└─────────────────────────────────────────┘
```

### Procedure

1. **Identify what to change** — Common tuning targets:
   - **Planner prompt** (`createPlanner` function) — controls step planning, mode selection
   - **Executor prompt** (`createExecutor` function) — controls tool calling, final answer format
   - **System context** (`AGENT_SYSTEM_CONTEXT` constant) — high-level persona
   - **Constants**: `MAX_ITERATIONS`, `HISTORY_RETENTION`, `PLANNER_HISTORY_LIMIT`

2. **Read current prompts**:
   ```
   Read supabase/functions/agent/index.ts
   Focus on: createPlanner (line ~296), createExecutor (line ~362), AGENT_SYSTEM_CONTEXT (line ~58)
   ```

3. **Make targeted edits** — Prompt changes should be:
   - Specific and directive (e.g., "You MUST return valid JSON only")
   - Additive when possible (add new instructions, don't rewrite existing working ones)
   - Tested in context (consider history truncation, token limits)

4. **Deploy immediately** — Agent changes are backend-only:
   ```bash
   npx supabase functions deploy agent --no-verify-jwt
   ```

5. **Test** — Ask the user to trigger the specific scenario in the chat UI

6. **Commit and push** — After confirming the change works

### Key Agent Config Points
| Config | Location | Controls |
|--------|----------|----------|
| Brain model | `system_settings.agent_default_brain_model` | Which LLM plans/executes |
| Image model | `system_settings.default_image_model` | Which model generates images |
| API host | `system_settings.gemini_api_host` | Gemini proxy/direct |
| History limit | `PLANNER_HISTORY_LIMIT` (code) | How much context planner sees |
| Max loops | `MAX_ITERATIONS` (code) | Max tool call rounds |

---

## Reference: Edge Functions

| Function | Purpose | JWT |
|----------|---------|-----|
| `agent` | Agent chat with tool calling (web search, image gen) | no-verify |
| `generate-image` | Single image generation (classic mode) | verify |
| `generate-ops` | Multi-step design operations (classic mode) | verify |
| `image-tools` | Image editing tools (background removal, etc.) | verify |
| `get-points` | Query user point balance | verify |
| `upload-asset` | Upload images to project storage | verify |

Deploy any function:
```bash
npx supabase functions deploy <name> [--no-verify-jwt]
```

---

## Reference: All system_settings Keys

| Key | Value Schema | Controls |
|-----|-------------|----------|
| `default_image_model` | `{ "model": "string" }` | Default image generation model |
| `agent_default_brain_model` | `{ "model": "string" }` | Agent planner/executor LLM |
| `gemini_api_host` | `{ "host": "https://..." }` | Gemini API proxy or direct endpoint |
| `model_config_enabled` | `{ "enabled": bool }` | Feature flag: allow BYOK provider configs |
| `provider_host_allowlist` | `{ "hosts": ["..."] }` | Allowed API hosts for user-configured providers |
| `inspiration_discovery_enabled` | `{ "enabled": bool }` | Feature flag: inspiration feed on homepage |
| `payment_enabled` | `{ "enabled": bool }` | Feature flag: payment system |
| `payment_env` | `{ "env": "sandbox"\|"production" }` | Payment environment |
| `payment_channels` | `{ "channels": [...] }` | Enabled payment channels |

Quick survey:
```sql
SELECT key, value FROM system_settings ORDER BY key;
```

---

## General Principles

- **Always check DB state before modifying** — `SELECT` before `INSERT`/`UPDATE`
- **Deploy before commit** for backend changes — faster feedback loop
- **Use MCP tools** — `mcp__supabase__execute_sql` for DB, `mcp__supabase__get_logs` for logs
- **Two-layer consistency** — `ai_models` (frontend) and `system_settings` (backend) must agree
- **Trace the full chain** — model name → resolution function → provider class → API call
- **Feature flags** — toggle via `system_settings`, no code deploy needed
