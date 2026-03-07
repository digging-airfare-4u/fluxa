## Why

当前 `model-config-settings` 需求已在 `.kiro/specs` 形成较完整定义，但尚未进入 OpenSpec 标准流程，导致后续实现、验证、归档缺少统一契约。需要将该能力正式纳入 OpenSpec，以便按 proposal → specs → design → tasks 推进并可验证。

## What Changes

- 将“用户自定义图像 Provider 配置”能力迁入 OpenSpec 变更流。
- 定义 `model-config-settings` 新能力规范，覆盖配置管理、安全、路由、计费与可观测性。
- 固化已确认决策：BYOK 免积分、`user:{configId}`、严格 allowlist、fail-closed、统一错误码 + HTTP 400、save 前重校验超时即失败不重试。
- 输出可执行的设计与任务清单，作为后续实现与验收依据。

## Capabilities

### New Capabilities
- `model-config-settings`: 用户可管理自定义图像 Provider 配置，并在生成链路按 `user:{configId}` 安全路由执行。

### Modified Capabilities
- （无）

## Impact

- 影响前端：设置面板、ModelSelector、生成前置校验逻辑。
- 影响 API：`/api/provider-configs/*`、`/api/test-provider`。
- 影响 Edge：`generate-image` 用户 provider 路由、错误码、计费与审计逻辑。
- 影响数据与安全：`user_provider_configs`、allowlist 读取与 fail-closed 监控告警。
