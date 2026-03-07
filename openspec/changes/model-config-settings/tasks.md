## 1. Data & Security Foundations

- [x] 1.1 Create/update `user_provider_configs` schema, indexes, and RLS policies
- [x] 1.2 Add safe view for masked key exposure and ensure plaintext key never returns to client
- [x] 1.3 Implement shared allowlist validator with strict `host:port` matching and `:443` normalization
- [x] 1.4 Implement allowlist source loading (`system_settings` primary, env fallback) with fail-closed behavior

## 2. API Validation & Persistence

- [x] 2.1 Implement `POST /api/test-provider` using `/models` + `/v1/models` + chat fallback (no image endpoint calls)
- [x] 2.2 Enforce edit-with-empty-key contract: require `configId`, load existing key server-side, and re-test
- [x] 2.3 Implement `POST/PATCH /api/provider-configs` final revalidation before persistence (TOCTOU guard)
- [x] 2.4 Enforce revalidation timeout fail-fast: reject save immediately without automatic retry

## 3. Frontend Integration

- [x] 3.1 Build ProviderConfigPanel and ProviderConfigForm for create/edit/enable/disable/delete flows
- [x] 3.2 Merge system and user models in ModelSelector with `user:{configId}` identifiers
- [x] 3.3 Show `BYOK` no-charge label for user-configured options
- [x] 3.4 Bypass insufficient-points precheck for selected `user:{configId}` models
- [x] 3.5 Preserve current selection and show actionable error when selected user model becomes invalid

## 4. Edge Routing, Billing & Error Contract

- [x] 4.1 Implement `generate-image` routing for `user:{configId}` with authenticated user-bound config resolution
- [x] 4.2 For invalid config, create job first then mark failed, return `USER_PROVIDER_CONFIG_INVALID` with HTTP 400
- [x] 4.3 Enforce edge-side allowlist re-check before outbound provider calls
- [x] 4.4 Apply BYOK billing behavior: `pointsDeducted=0`, realtime `remainingPoints`, no 0-point transaction writes
- [x] 4.5 Bypass edge insufficient-points gating for BYOK requests

## 5. Observability, Rollout & Verification

- [x] 5.1 Emit fail-closed logs and monitoring alerts via observability channel (no admin banner dependency)
- [x] 5.2 Add KPI instrumentation: config save success, test-provider success, BYOK generation success
- [x] 5.3 Add/extend tests for error contract (code + HTTP 400), TOCTOU timeout fail-fast, and BYOK points behavior
- [x] 5.4 Validate OpenSpec artifacts and run implementation quality gates (`pnpm test`, `pnpm lint`)
