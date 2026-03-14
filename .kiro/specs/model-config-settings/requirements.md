# Requirements Document

## Introduction

用户自定义图像生成 Provider 配置功能。Gemini 作为内置默认 Provider（系统级 API Key，开箱即用）。其他 Provider（Volcengine/豆包，或任意 OpenAI 兼容图像生成服务）由用户提供 API Key 和 Endpoint。用户在 `/app` 首页通过设置面板管理 Provider 配置，配置完成后在编辑器 `ModelSelector` 可选。

本规格基于现有 `OpenAICompatibleClient`、`ai_models`、`system_settings`、`ProviderRegistry` 扩展用户级 Provider 能力，并明确：
- 仅用户自定义配置（`model=user:{configId}`）不扣平台积分
- Custom OpenAI-Compatible 支持同一用户多配置
- 外部 Endpoint 仅允许严格白名单 `host:port`
- 用户模型使用 `user:{configId}` 标识；系统模型继续使用原始 `model_name`
- 编辑配置时若 API Key 留空（复用旧 key），仍必须执行联通测试后才可保存
- 白名单配置缺失/为空时必须 fail-closed（拒绝测试与外部调用）
- BYOK 成功响应必须返回 `pointsDeducted=0`，且 `remainingPoints` 来自请求时实时余额
- BYOK 请求在前后端都不走“积分不足”拦截
- `user:{configId}` 失效相关错误统一使用单一错误码
- 配置保存前必须在服务端执行最终一次重校验（防 TOCTOU）
- `user:{configId}` 失效错误统一返回 HTTP 400
- save 前最终重校验超时时直接拒绝保存（不重试）
- fail-closed 运维通知仅通过监控告警通道，不新增应用内 admin banner

## Glossary

- **Provider_Config_Panel**: `/app` 首页左侧导航设置入口打开的 Provider 配置面板
- **User_Provider_Config**: `user_provider_configs` 表中的用户级配置记录
- **Provider_Config_Service**: 前端读写用户 Provider 配置的服务层
- **Provider_Model_Identifier**: 模型选择标识，仅用户模型采用 `user:{configId}`
- **Allowed_Provider_Hosts**: 平台允许访问的第三方 Provider `host:port` 精确白名单（`https` 未显式端口时按 `:443` 规范化后匹配）

## Requirements

### Requirement 1: Provider 配置面板入口与展示

**User Story:** 作为用户，我希望在 `/app` 首页通过设置入口查看和管理图像 Provider 配置状态。

#### Acceptance Criteria

1. THE Provider_Config_Panel SHALL be accessible from Home left navigation as a settings icon button
2. WHEN user clicks settings icon, THE Provider_Config_Panel SHALL open as dialog or slide-over
3. THE panel SHALL show Gemini section with status "内置 / 已配置" and no editable credentials
4. THE panel SHALL show Volcengine section and Custom OpenAI-Compatible section
5. THE Volcengine section and Custom OpenAI-Compatible section SHALL both support multiple saved configs and provide "新增配置" action
6. THE panel SHALL show config status per item (已配置/未配置/已禁用)
7. THE panel SHALL support light/dark themes and 768px–1920px viewport usability

### Requirement 2: 用户配置存储与安全

**User Story:** 作为用户，我希望 Provider 配置被安全持久化，且仅我自己可访问。

#### Acceptance Criteria

1. THE system SHALL store configs in `user_provider_configs` with fields: `id`, `user_id`, `provider`, `api_key_encrypted`, `api_key_last4`, `api_url`, `model_name`, `display_name`, `is_enabled`, `created_at`, `updated_at`
2. THE system SHALL encrypt API key before persistence and SHALL never return plaintext key to frontend
3. THE table SHALL enforce RLS so each user can only SELECT/INSERT/UPDATE/DELETE own records
4. WHEN user creates a new config, THE Provider_Config_Service SHALL insert a new record
5. WHEN user edits an existing config, THE Provider_Config_Service SHALL update by `id` (not by `provider`)
6. THE system SHALL allow multiple records for configurable providers (`volcengine`, `openai-compatible`) under the same user
7. THE system SHALL enforce uniqueness for `(user_id, model_name)` to avoid ambiguous routing
8. IF DB operation fails, THEN system SHALL show user-friendly error and log contextual details

### Requirement 3: Gemini 内置默认 Provider

**User Story:** 作为用户，我希望 Gemini 无需配置即可直接使用，并作为默认图像模型。

#### Acceptance Criteria

1. THE system SHALL use system-level keys (environment + System_Config) for Gemini
2. THE system SHALL set `gemini-3-pro-image-preview` as `is_default=true` in `ai_models`
3. THE system SHALL set `doubao-seedream-4-5-251128` as `is_default=false`
4. WHEN migration is applied, THE system SHALL ensure exactly one `type='image'` model has `is_default=true`
5. THE runtime default model in `generate-image` SHALL align with DB default policy (query DB default or fallback `gemini-3-pro-image-preview`)
6. WHEN user has no custom configs, THE ModelSelector SHALL show system-enabled image models and MUST include Gemini

### Requirement 4: 配置表单验证与联通测试

**User Story:** 作为用户，我希望配置时得到即时验证反馈，避免无效配置入库。

#### Acceptance Criteria

1. THE form SHALL include API Key, API URL/Endpoint, Model Name, Display Name
2. THE form SHALL validate all required fields as non-empty (trimmed)
3. WHEN user submits config, THE system SHALL call server-side test endpoint for key + endpoint validation
4. WHEN test succeeds, THE panel SHALL show success feedback and persist config
5. WHEN test fails, THE panel SHALL show actionable error detail and prevent persistence
6. AFTER save, THE UI SHALL display API key masked as `****` + last4
7. WHEN editing non-key fields, THE system SHALL allow preserving existing key without forced re-entry
8. THE test endpoint SHALL reject any target endpoint whose normalized `host:port` is not exactly in Allowed_Provider_Hosts
9. THE test endpoint SHALL validate only via list-models + fallback chat checks, and SHALL NOT call image generation endpoints during configuration validation
10. WHEN API key is omitted during edit, THE request SHALL include `configId`, and THE system SHALL load existing key server-side by `user_id + configId` and SHALL re-run test validation before persisting changes
11. IF Allowed_Provider_Hosts cannot be loaded or resolves to empty, THEN THE test endpoint SHALL fail-closed and reject validation with actionable error
12. BEFORE final DB persistence (`POST`/`PATCH`), THE server SHALL perform one last server-side revalidation (allowlist + credential connectivity) and SHALL reject save if revalidation fails, even if a previous test call succeeded
13. IF final server-side revalidation times out, THEN save SHALL be rejected immediately (fail-fast) and SHALL NOT perform automatic retry

### Requirement 5: 自定义 Provider 与 Edge Function 集成

**User Story:** 作为用户，我希望选择自定义 Provider 时真正使用我的 Key 进行生成。

#### Acceptance Criteria

1. WHEN `model` matches `user:{configId}`, THE Edge_Function SHALL resolve config by authenticated `user_id + configId`
2. WHEN valid config is found and enabled, THE Edge_Function SHALL create `OpenAI_Compatible_Client` with decrypted key and configured URL
3. WHEN config is missing/disabled/deleted or otherwise invalid, THE Edge_Function SHALL create generation job first and then mark job as `failed` for audit, return structured error with single code `USER_PROVIDER_CONFIG_INVALID` and HTTP status 400, and SHALL NOT fallback to system model automatically
4. WHEN request uses system `model_name`, THE Edge_Function SHALL use system ProviderRegistry flow
5. IF user-configured provider returns error, THEN job failure output SHALL include provider status and message (without credentials)
6. FOR user-configured providers, THE system SHALL NOT deduct platform points (`pointsDeducted=0`) and SHALL return `remainingPoints` from fresh balance read at request time
7. THE Edge_Function SHALL reject user-provider calls whose `host:port` is not exactly in Allowed_Provider_Hosts
8. FOR user-configured providers, THE system SHALL NOT add extra BYOK-specific rate limiting logic beyond existing platform baseline behavior
9. FOR user-configured providers, THE system SHALL NOT create point transaction records
10. FOR user-configured providers (`model=user:{configId}`), THE Edge_Function SHALL bypass insufficient-points precheck and SHALL allow request execution regardless of current points

### Requirement 6: ModelSelector 与用户配置集成

**User Story:** 作为用户，我希望在 ModelSelector 同时看到系统模型和我启用的自定义模型，并正确路由。

#### Acceptance Criteria

1. THE ModelSelector SHALL always display Gemini models
2. WHEN user has enabled configs, THE ModelSelector SHALL include them using `display_name`
3. WHEN config is disabled, THE ModelSelector SHALL exclude it
4. WHEN config is deleted, THE ModelSelector SHALL remove it immediately
5. WHEN selecting user config, THE client SHALL pass `model=user:{configId}`; when selecting system model, SHALL pass original `model_name`
6. FOR user-configured options, THE UI SHALL indicate no-charge state as `BYOK`
7. WHEN generation fails because a selected `user:{configId}` is invalid/disabled/deleted, THE client SHALL keep current selection and show actionable error, and SHALL NOT auto-switch model
8. WHEN selected model is `user:{configId}`, THE client SHALL bypass insufficient-points precheck and SHALL submit generation request directly

### Requirement 7: 启用/禁用/删除管理

**User Story:** 作为用户，我希望灵活控制哪些自定义 Provider 可用。

#### Acceptance Criteria

1. FOR each saved config, THE panel SHALL show enable/disable toggle
2. WHEN toggled disabled, THE system SHALL persist `is_enabled=false`
3. WHEN toggled enabled, THE system SHALL persist `is_enabled=true`
4. WHILE disabled, THE config SHALL not appear in ModelSelector
5. THE panel SHALL allow deleting config record and its stored credentials

### Requirement 8: 可观测性、白名单治理与上线验收

**User Story:** 作为平台 owner，我希望该能力可观测、可灰度、可回滚，并具备严格的外部调用治理。

#### Acceptance Criteria

1. THE system SHALL log config save/test/generation failures with context (`user_id`, `provider`, `model_name`, request_id) and MUST NOT log plaintext API key
2. THE system SHALL manage Allowed_Provider_Hosts via `system_settings` (manual admin SQL/console update) with env fallback and documented update process
3. THE system SHALL use short-lived cache (e.g. 60s) for allowlist reads from `system_settings` in API/Edge runtime
4. THE feature SHALL define launch KPIs: config save success rate, test success rate, BYOK generation success rate
5. THE rollout SHALL support feature flag/phased release and documented rollback
6. IF allowlist source is unavailable or parsed as empty, THEN API/Edge runtime SHALL fail-closed and reject third-party provider test/generation calls until configuration is restored
7. WHEN fail-closed is triggered by allowlist misconfiguration, THE system SHALL emit error logs and metrics/alerts via monitoring channels only, and SHALL NOT rely on application-side admin banner notifications
