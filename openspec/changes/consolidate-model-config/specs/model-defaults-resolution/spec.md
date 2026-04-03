## ADDED Requirements

### Requirement: Hardcoded fallback model constants are defined in a single shared module
The system SHALL define all fallback model name constants (`DEFAULT_CHAT_MODEL`, `DEFAULT_IMAGE_MODEL`, `DEFAULT_AGENT_IMAGE_MODEL`, `DEFAULT_VOLCENGINE_IMAGE_MODEL`) in exactly one file (`_shared/defaults.ts`). No edge function SHALL hardcode model name strings inline for default resolution.

#### Scenario: Fallback constant referenced from edge function
- **WHEN** any edge function needs a hardcoded fallback model name
- **THEN** it SHALL import the constant from `_shared/defaults.ts` instead of declaring a local string literal

### Requirement: Chat model default resolution follows a unified two-layer fallback chain
All edge functions that resolve a default chat model SHALL follow the same chain: `system_settings` table lookup (`default_chat_model` key) → `DEFAULT_CHAT_MODEL` constant from `_shared/defaults.ts`. No environment variable SHALL participate in the model selection chain.

#### Scenario: system_settings row exists for default chat model
- **WHEN** `system_settings` contains a row with key `default_chat_model` and a non-empty `model` value
- **THEN** the edge function SHALL use that value as the default chat model

#### Scenario: system_settings row missing
- **WHEN** `system_settings` has no `default_chat_model` row
- **THEN** the edge function SHALL use `DEFAULT_CHAT_MODEL` from `_shared/defaults.ts`

### Requirement: Image model default resolution follows a unified two-layer fallback chain
All edge functions that resolve a default image model (`generate-image`, `image-tools`, `agent` image generation) SHALL follow the same chain: `system_settings` table lookup (`default_image_model` key) → hardcoded constant from `_shared/defaults.ts`. The specific hardcoded constant depends on the function context (`DEFAULT_IMAGE_MODEL` for `generate-image`/`image-tools`, `DEFAULT_AGENT_IMAGE_MODEL` for `agent`).

#### Scenario: generate-image receives no model in request
- **WHEN** `generate-image` receives a request with no `model` field
- **THEN** it SHALL resolve the default via `system_settings(default_image_model)` → `DEFAULT_IMAGE_MODEL` from `_shared/defaults.ts`

#### Scenario: image-tools resolves default model
- **WHEN** `image-tools` receives a request with no `model` field and the `ai_models` DB query returns no enabled model
- **THEN** it SHALL resolve the default via `system_settings(default_image_model)` → `DEFAULT_IMAGE_MODEL` from `_shared/defaults.ts`

#### Scenario: agent resolves default image model
- **WHEN** the agent needs to generate an image and no `imageModel` is specified in the request
- **THEN** it SHALL resolve the default via `system_settings(default_image_model)` → `DEFAULT_AGENT_IMAGE_MODEL` from `_shared/defaults.ts`

#### Scenario: Super-admin configures global default image model
- **WHEN** a super-admin sets `default_image_model` in `system_settings`
- **THEN** all image-generation functions SHALL use that value as their default image model

### Requirement: Agent brain model resolution follows a two-level DB fallback chain
The agent edge function SHALL resolve its brain model as: `system_settings(agent_default_brain_model)` → `system_settings(default_chat_model)` → `DEFAULT_CHAT_MODEL` constant from `_shared/defaults.ts`. This allows a single `default_chat_model` setting to control both single-turn and multi-turn defaults, while `agent_default_brain_model` provides an agent-specific override when needed.

#### Scenario: agent_default_brain_model set in system_settings
- **WHEN** `system_settings` contains `agent_default_brain_model` with a non-empty `model` value
- **THEN** the agent SHALL use that value as its brain model

#### Scenario: agent_default_brain_model absent, default_chat_model set
- **WHEN** `system_settings` has no `agent_default_brain_model` but has `default_chat_model` with a non-empty `model` value
- **THEN** the agent SHALL use the `default_chat_model` value as its brain model

#### Scenario: Both DB keys absent
- **WHEN** neither `agent_default_brain_model` nor `default_chat_model` exists in `system_settings`
- **THEN** the agent SHALL use `DEFAULT_CHAT_MODEL` from `_shared/defaults.ts`

### Requirement: No environment variable participates in model name selection
The system SHALL NOT read `AGENT_RUNTIME_MODEL`, `VOLCENGINE_IMAGE_MODEL`, or `DEFAULT_AI_MODEL` for model name resolution. Environment variables SHALL be reserved for infrastructure configuration only (API keys, API base URLs). All model name overrides SHALL go through `system_settings`.

#### Scenario: AGENT_RUNTIME_MODEL env var is set
- **WHEN** `AGENT_RUNTIME_MODEL` is present in the environment
- **THEN** the system SHALL ignore it; it has no effect on model resolution

#### Scenario: VOLCENGINE_IMAGE_MODEL env var is set
- **WHEN** `VOLCENGINE_IMAGE_MODEL` is present in the environment
- **THEN** the system SHALL ignore it; it has no effect on model resolution

#### Scenario: DEFAULT_AI_MODEL env var is set
- **WHEN** `DEFAULT_AI_MODEL` is present in the environment
- **THEN** the system SHALL ignore it for model selection purposes; it has no effect on default model resolution

### Requirement: Gemini provider configuration is consolidated
The Gemini provider SHALL resolve its API mode, URL, and key from a single configuration path. If the `native` mode is the only active mode, the `GEMINI_IMAGE_API_MODE`, `GEMINI_IMAGE_API_URL`, and `GEMINI_IMAGE_API_KEY` environment variables SHALL be removed. If both modes are retained, these settings SHALL be consolidated into a `system_settings` row.

#### Scenario: Only native mode is active
- **WHEN** the system uses only Gemini native API mode
- **THEN** the provider SHALL read `GEMINI_API_KEY` and `gemini_api_host` from `system_settings`, and SHALL NOT read `GEMINI_IMAGE_API_MODE`, `GEMINI_IMAGE_API_URL`, or `GEMINI_IMAGE_API_KEY`

#### Scenario: Both native and OpenAI-compat modes are retained
- **WHEN** the system supports both Gemini API modes
- **THEN** mode selection and OpenAI-compat endpoint config SHALL be stored in a `system_settings` row (`gemini_image_config`) instead of separate environment variables
