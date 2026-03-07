## Context

Fluxa 现有图像生成链路以系统模型为主，需要支持用户 BYOK（自定义 Provider）并保持安全、可审计和清晰计费语义。  
`.kiro/specs/model-config-settings/*` 已沉淀业务决策，本设计将其转为 OpenSpec 实施设计。

关键约束：
- 系统模型保持原 `model_name`；用户模型用 `user:{configId}`。
- BYOK 不扣平台积分，前后端均绕过积分不足拦截。
- 第三方 endpoint 严格 allowlist；allowlist 异常必须 fail-closed。
- 无效用户配置统一 `USER_PROVIDER_CONFIG_INVALID` + HTTP 400。
- save 前最终重校验；超时即失败，不自动重试。

## Goals / Non-Goals

**Goals:**
- 提供完整 BYOK 配置生命周期：创建、测试、保存、启停、删除、选择、生成。
- 确保外部调用治理：严格 host:port allowlist + fail-closed。
- 保证计费与响应语义一致：`pointsDeducted=0`、`remainingPoints` 实时读取。
- 提供稳定错误契约与审计链路：create-job-then-fail + 统一错误码/状态码。

**Non-Goals:**
- 不新增应用内 allowlist 管理后台。
- 不新增 BYOK 专属限流策略。
- 不在本次改动中引入新的支付/积分模型。

## Decisions

1. **模型标识协议**
   - 选择：系统模型用 `model_name`，用户模型用 `user:{configId}`。
   - 理由：最小化对现有系统模型链路影响，且用户模型路由明确可判定。

2. **保存一致性（TOCTOU 防护）**
   - 选择：`POST/PATCH` 落库前执行最终重校验；重校验超时 fail-fast，不重试。
   - 理由：避免 test 与 save 间状态漂移导致脏配置入库；控制请求放大风险。

3. **allowlist 安全策略**
   - 选择：仅 `https`，`host:port` 精确匹配（`https` 默认 `:443` 归一化）；来源失效时 fail-closed。
   - 理由：降低 SSRF 与误放行风险，优先安全边界。

4. **无效用户配置错误契约**
   - 选择：统一返回 `USER_PROVIDER_CONFIG_INVALID` + HTTP 400；先建 job 后置 failed。
   - 理由：前端处理分支简单且可追踪；审计与排障具备完整 job 记录。

5. **BYOK 计费与积分拦截**
   - 选择：BYOK 不扣积分，不记 0 分流水，前后端绕过积分不足拦截，返回实时 `remainingPoints`。
   - 理由：避免错误拦截和账务噪音，保持“用户自带 Key”语义一致。

6. **fail-closed 可观测性**
   - 选择：通过日志 + 监控告警通道通知，不依赖应用内 admin banner。
   - 理由：与现有运维流程一致，避免新增 UI 依赖。

## Risks / Trade-offs

- **[Risk] 重校验增加保存时延** → **Mitigation**: 仅在落库前执行一次；超时快速失败并提示用户重试。
- **[Risk] fail-closed 可能造成短期可用性下降** → **Mitigation**: 监控告警快速发现，完善运维恢复指引。
- **[Risk] 统一错误码降低细粒度诊断** → **Mitigation**: 在日志/审计中保留细分内部原因字段。
- **[Risk] BYOK 绕过积分拦截可能引发误解** → **Mitigation**: UI 持续显示 `BYOK` 标识与免积分提示。

## Migration Plan

1. 建立 `user_provider_configs` 与安全视图/RLS。
2. 上线 API（`provider-configs`、`test-provider`）并接入 allowlist 校验。
3. 接入前端设置面板与 ModelSelector BYOK 语义。
4. 切换 Edge `generate-image` 到 `user:{configId}` 路由逻辑。
5. 启用监控告警与灰度开关，按阶段放量。
6. 回滚策略：关闭 feature flag，恢复系统模型路径为主，不影响既有 Gemini 流程。

## Open Questions

- 无（当前产品决策已闭环，后续仅在实现阶段校准阈值与告警路由配置）。
