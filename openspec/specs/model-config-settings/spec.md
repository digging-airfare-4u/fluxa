## Purpose

Define behavior and constraints for user-configured BYOK model providers, including secure config management, strict endpoint governance, deterministic edge routing, and billing semantics.

## Requirements

### Requirement: Provider configuration panel supports multi-config management
The system SHALL provide a settings entry on `/app` home and let users create, edit, enable/disable, and delete multiple `volcengine` and `openai-compatible` configurations.

#### Scenario: Open and manage provider configs
- **WHEN** the user opens the settings panel from `/app`
- **THEN** the UI shows Gemini as built-in read-only and shows editable multi-config sections for Volcengine and OpenAI-compatible providers

### Requirement: Provider credentials are stored securely with tenant isolation
The system SHALL persist provider configs in `user_provider_configs` with encrypted API keys, masked key display, and strict user-level RLS isolation.

#### Scenario: Save and read config safely
- **WHEN** a user creates or updates a provider config
- **THEN** API key plaintext is never returned to frontend and only the owner user can read/write that record

### Requirement: User model identifier uses user-prefixed contract
The system SHALL use original `model_name` for system models and SHALL use `user:{configId}` only for user-defined models.

#### Scenario: Submit generation with selected model
- **WHEN** user selects a custom provider config in ModelSelector
- **THEN** client sends `model=user:{configId}` and system model selection continues sending original `model_name`

### Requirement: Provider test validation enforces strict allowlist and edit semantics
The system SHALL validate provider connectivity via `/models` or `/v1/models` with chat fallback, MUST NOT call image-generation endpoints, and SHALL require `configId` when edit request omits `apiKey`.

#### Scenario: Edit config with empty apiKey
- **WHEN** user edits non-key fields and leaves `apiKey` empty
- **THEN** request includes `configId` and server loads existing key by `user_id + configId` to run mandatory re-test

### Requirement: Allowlist evaluation is strict and fail-closed
The system SHALL allow only exact `host:port` matches (including `https` default `:443` normalization) and SHALL fail-closed if allowlist source is missing or empty.

#### Scenario: Allowlist source unavailable
- **WHEN** allowlist cannot be loaded from `system_settings` and env fallback is unavailable or empty
- **THEN** test and generation requests to third-party providers are rejected before outbound calls

### Requirement: Save endpoint performs final revalidation with timeout fail-fast
Before final config persistence, the server SHALL execute one final revalidation (allowlist + credential connectivity) and SHALL reject save on timeout without automatic retry.

#### Scenario: Timeout during final revalidation
- **WHEN** final revalidation times out during `POST` or `PATCH`
- **THEN** save fails immediately with actionable error and no automatic retry is executed

### Requirement: Edge user-provider routing is auditable and deterministic
For invalid user config (`missing/disabled/deleted`), the Edge function SHALL create generation job first, then mark it `failed`, and return error code `USER_PROVIDER_CONFIG_INVALID` with HTTP 400, without fallback to system model.

#### Scenario: Selected user config is invalid
- **WHEN** `generate-image` receives `model=user:{configId}` and config is not usable
- **THEN** system records auditable failed job and returns `USER_PROVIDER_CONFIG_INVALID` with HTTP 400

### Requirement: BYOK generation bypasses points gating and keeps billing neutral
For user-configured providers, the system SHALL bypass insufficient-points precheck on client and edge, SHALL return `pointsDeducted=0`, SHALL return `remainingPoints` from fresh per-request balance read, and SHALL NOT create 0-point transactions.

#### Scenario: Successful BYOK generation
- **WHEN** generation succeeds via `model=user:{configId}`
- **THEN** response includes `pointsDeducted=0` and realtime `remainingPoints`, and no points transaction record is created

### Requirement: UI behavior remains stable on invalid selected user model
If generation fails due to invalid selected `user:{configId}`, the client SHALL keep current model selection, show actionable guidance, and SHALL NOT auto-switch to system model.

#### Scenario: Generation fails on stale selected user model
- **WHEN** frontend submits stale or disabled `user:{configId}`
- **THEN** selection remains unchanged and UI prompts user to repair config in settings

### Requirement: Fail-closed events are observable via monitoring channels
When fail-closed is triggered by allowlist misconfiguration, the system SHALL emit error logs and monitoring alerts, and SHALL NOT depend on app-side admin banner notifications.

#### Scenario: Allowlist misconfiguration triggers fail-closed
- **WHEN** runtime detects allowlist unavailable/empty
- **THEN** system logs error context and sends monitoring alert through configured observability channel
