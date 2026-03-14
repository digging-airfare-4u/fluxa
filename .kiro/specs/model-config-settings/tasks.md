# Implementation Plan: Model Config Settings

## Overview

本实现按“数据安全 → API → 前端状态统一 → Edge 路由 → 测试验收”推进，确保以下决策落地：
- 用户模型标识 `user:{configId}`，系统模型保持原 `model_name`
- `volcengine` 与 `openai-compatible` 均支持一用户多配置
- 用户 BYOK 图像生成不扣平台积分
- 外部 Endpoint 严格白名单
- 白名单配置缺失/空时 fail-closed
- BYOK 响应返回 `pointsDeducted=0` 且 `remainingPoints` 为实时余额
- BYOK 前后端都绕过“积分不足”拦截
- `user:{id}` 失效统一错误码 `USER_PROVIDER_CONFIG_INVALID`
- `user:{id}` 失效统一返回 HTTP 400
- 保存前服务端最终重校验（防 TOCTOU）
- save 前重校验超时即拒绝保存且不重试
- fail-closed 运维仅监控告警通道（无 admin banner 依赖）

## Tasks

- [ ] 1. 数据库与默认模型改造
  - [ ] 1.1 新增 SQL 脚本（放在 `supabase/*.sql`）
    - 创建/更新 `user_provider_configs`（`api_key_encrypted`, `api_key_last4`, `api_url`, `model_name`, `display_name`, `is_enabled`）
    - 约束：保留 `UNIQUE(user_id, model_name)`；移除/不添加 `UNIQUE(user_id, provider)` 以支持多 custom config
    - 增加索引 `(user_id, is_enabled)`
    - 开启 RLS 并配置 SELECT/INSERT/UPDATE/DELETE 策略
    - 创建 `user_provider_configs_safe` 视图（仅 masked key）
    - _Requirements: 2.1-2.8_

  - [ ] 1.2 默认图像模型迁移
    - 事务中重置 `type='image'` 默认值
    - 将 `gemini-3-pro-image-preview` 设为唯一默认
    - 增加“默认模型数量=1”校验
    - _Requirements: 3.2-3.5_

- [ ] 2. 白名单能力（共享基础模块）
  - [ ] 2.1 新建白名单校验工具
    - 建议位置：`src/lib/security/provider-host-allowlist.ts`（Next）
    - Edge 同步实现：`supabase/functions/_shared/security/provider-host-allowlist.ts`
    - 规则：仅 https、`host:port` 严格命中白名单、拒绝 IP/localhost/私网段
    - 规范化：`https` 未显式端口时按 `:443` 后再匹配
    - _Requirements: 4.8, 5.7, 8.2_

  - [ ] 2.2 定义白名单配置来源
    - `system_settings.provider_host_allowlist` 作为主配置
    - 环境变量 `PROVIDER_HOST_ALLOWLIST` 作为兜底
    - 白名单仅允许管理员通过 SQL / 控制台维护，不新增应用内管理 API
    - 读取策略采用 60s 短缓存（API/Edge 同步）
    - 若白名单来源不可用或解析为空，API/Edge 统一 fail-closed（拒绝 test/generation）
    - _Requirements: 8.2, 8.6_

- [ ] 3. Next API 路由：配置管理与测试
  - [ ] 3.1 创建 `src/app/api/provider-configs/route.ts`
    - `GET` 当前用户配置列表（masked）
    - `POST` 新建配置（不按 provider upsert）
    - `POST` 在最终持久化前执行一次重校验（allowlist + 认证可用性），失败拒绝保存
    - 重校验超时时立即拒绝保存，不做自动重试
    - _Requirements: 2.4, 2.6, 4.12, 4.13, 6.2_

  - [ ] 3.2 创建 `src/app/api/provider-configs/[id]/route.ts`
    - `PATCH`：更新配置字段或 `is_enabled`
    - `DELETE`：删除配置与凭据
    - 更新语义按 `id`
    - `PATCH` 持久化前执行最终重校验；编辑且 `apiKey` 为空时按 `user_id + configId` 取旧 key
    - 重校验超时时立即拒绝保存，不做自动重试
    - _Requirements: 2.5, 4.10, 4.12, 4.13, 7.2-7.5_

  - [ ] 3.3 创建 `src/app/api/test-provider/route.ts`
    - 参数校验
    - 先验白名单，再发起第三方验证请求
    - `/models`/`/v1/models` + fallback chat completion
    - 编辑且 `apiKey` 为空时，请求必须带 `configId`，服务端按 `user_id + configId` 取旧 key 强制重测
    - 白名单来源不可用/为空时 fail-closed 拒绝验证
    - 不调用图片生成端点做验证
    - _Requirements: 4.3-4.5, 4.8-4.11, 8.6_

  - [ ] 3.4 统一失效错误码与保存防漂移
    - `user:{id}` 失效（不存在/禁用/删除）统一返回 `USER_PROVIDER_CONFIG_INVALID` + HTTP 400
    - 保存接口重校验失败时返回可操作错误，避免 test/save 间状态漂移（TOCTOU）
    - 重校验超时返回明确超时错误，且不自动重试
    - _Requirements: 4.12, 4.13, 5.3_

- [ ] 4. 前端服务层与类型
  - [ ] 4.1 新建 `src/lib/api/provider-configs.ts`
    - `fetchUserProviderConfigs`
    - `createProviderConfig`
    - `updateProviderConfig`
    - `updateProviderEnabled`
    - `deleteProviderConfig`
    - 定义 `UserModelIdentifier = user:{configId}`
    - _Requirements: 2.4-2.6, 6.5_

  - [ ] 4.2 新建模型标识 helper
    - `isUserModelIdentifier(value)`
    - `toUserModelIdentifier(configId)`
    - _Requirements: 5.1, 6.5_

- [ ] 5. Provider 配置 UI
  - [ ] 5.1 创建 `src/components/settings/ProviderConfigForm.tsx`
    - 字段与校验（编辑可保留旧 key；留空 key 时传 `configId`）
    - 保存流程：先 test，再 persist；persist 前由服务端再校验一次
    - 支持 toggle/delete
    - _Requirements: 4.1-4.7, 4.10, 4.12-4.13, 7.1-7.5_

  - [ ] 5.2 创建 `src/components/settings/ProviderConfigPanel.tsx`
    - Gemini 固定区块
    - Volcengine 配置区块
    - Volcengine 列表 + Custom OpenAI-Compatible 列表（两者都支持多配置）
    - _Requirements: 1.1-1.7_

  - [ ] 5.3 在 `src/app/app/page.tsx` 增加 settings 入口
    - 打开 `ProviderConfigPanel`
    - _Requirements: 1.1, 1.2_

- [ ] 6. 模型源统一与 ModelSelector 集成
  - [ ] 6.1 统一模型源（避免 selector/store 分叉）
    - 将系统模型 + 用户模型合并逻辑抽为共享函数（建议 `src/lib/models/resolve-selectable-models.ts`）
    - `ChatPanel`、`ModelSelector`、`useChatStore` 使用同一模型列表
    - _Requirements: 6.1-6.5_

  - [ ] 6.2 修改 `src/components/chat/ModelSelector.tsx`
    - 系统模型 value 用 `model.name`
    - 用户模型 value 用 `user:{configId}`
    - BYOK 模型显示 `BYOK` 标记
    - _Requirements: 6.1-6.6_

  - [ ] 6.3 修改 `src/components/chat/ChatPanel.tsx` 与 `src/lib/store/useChatStore.ts`
    - 识别 `user:` 为图像模型，不误路由到 ops 生成
    - 默认选择逻辑与系统默认模型一致
    - `user:{id}` 失效失败时保持当前选择，不自动切回系统模型
    - `user:{id}` 模型绕过前端“积分不足”前置拦截，直接发起请求
    - _Requirements: 3.5, 6.5, 6.8_

- [ ] 7. Edge Function：用户 Provider 路由与计费
  - [ ] 7.1 创建 `supabase/functions/_shared/services/user-provider.ts`
    - `getConfigById(userId, configId)`
    - 解密 `api_key_encrypted`
    - _Requirements: 5.1, 5.2_

  - [ ] 7.2 创建 `supabase/functions/_shared/providers/user-configured-provider.ts`
    - 封装 OpenAICompatibleClient
    - _Requirements: 5.2, 5.5_

  - [ ] 7.3 修改 `supabase/functions/generate-image/index.ts`
    - `model` 以 `user:` 开头走用户配置链路
    - 否则走系统 registry
    - `user:{id}` 未命中/禁用/删除时：先创建 job，再置 failed（审计）并返回 `USER_PROVIDER_CONFIG_INVALID` + HTTP 400（不自动回退系统模型）
    - _Requirements: 5.1-5.4_

  - [ ] 7.4 BYOK 不扣分
    - 用户模型跳过 points 扣减流程，返回 `pointsDeducted=0`
    - `remainingPoints` 按请求实时查库返回当前余额
    - 用户模型绕过后端“积分不足”前置拦截
    - 用户模型不写 0 分 point transaction 记录
    - 系统模型保持现有扣分逻辑
    - 不新增 BYOK 专用限流逻辑
    - _Requirements: 5.6, 5.9, 5.10_

  - [ ] 7.5 白名单二次校验与错误脱敏
    - Edge 发外部请求前再校验 host
    - 白名单来源不可用/为空时 fail-closed 直接拒绝
    - 失败输出不含 API key、Authorization
    - fail-closed 事件记录 error 并打点触发监控告警（无 admin banner 依赖）
    - _Requirements: 5.5, 5.7, 8.1, 8.6, 8.7_

- [ ] 8. 测试（必做）
  - [ ] 8.1 Property tests（至少 P1-P29）
    - 覆盖：存储/隔离/更新语义/默认模型/validation/masking/路由/白名单/BYOK不扣分+实时余额/无效用户模型先建job再failed且统一错误码+HTTP400/443规范化/失败不自动切模/编辑留空key重测且缺configId拒绝/白名单缺失fail-closed/保存前最终重校验/重校验超时即失败且不重试/BYOK前后端绕过积分不足拦截/不写0分交易/fail-closed 仅监控告警通道
    - _Requirements: 全量关键条目_

  - [ ] 8.2 Unit/Integration tests
    - `/api/provider-configs` 与 `/api/test-provider`
    - `/api/provider-configs` 的 save 前最终重校验（TOCTOU 防护）
    - save 前重校验超时立即失败且不自动重试
    - `/api/test-provider` 编辑留空 key 必须 `configId`
    - allowlist 缺失/空时 test-provider 与 generate-image 都 fail-closed
    - ProviderConfigPanel/Form 多配置行为
    - `generate-image` 对 `user:{id}` 的解析与统一错误码 `USER_PROVIDER_CONFIG_INVALID`（HTTP 400）
    - BYOK 返回值（`pointsDeducted=0` + 实时 `remainingPoints`）与前端展示一致
    - BYOK 前后端都绕过“积分不足”前置拦截

  - [ ] 8.3 验证命令
    - `pnpm test`
    - `pnpm lint`

- [ ] 9. 可观测性与上线准备
  - [ ] 9.1 日志字段与脱敏规则
    - `user_id`, `provider`, `model_name`, `request_id`
    - 禁止明文 key 日志
    - _Requirements: 8.1_

  - [ ] 9.1.1 fail-closed 告警链路
    - allowlist 缺失/空触发时写 error 日志
    - 上报指标并接入监控告警（报警阈值与通知渠道）
    - 不依赖应用内 admin banner；恢复路径通过监控告警说明与运维文档提供
    - _Requirements: 8.7_

  - [ ] 9.2 KPI 埋点与看板
    - 配置保存成功率
    - test-provider 成功率
    - BYOK 生成成功率
    - _Requirements: 8.3_

  - [ ] 9.3 灰度与回滚
    - feature flag 默认关闭
    - 明确回滚流程
    - _Requirements: 8.4_

## Notes

- 本计划已按当前产品决策集对齐（多配置 + BYOK + 严格白名单 + fail-closed + failed job 审计 + 443规范化 + 失败不自动切模 + 编辑留空key需`configId`重测 + BYOK返回余额字段 + BYOK前后端绕过积分拦截 + 统一错误码+HTTP400 + save前重校验 + 重校验超时不重试 + 告警仅监控通道）。
- 测试不是可选项，属于上线门槛。
- API 错误结构统一 `{ error: { code, message } }`。
