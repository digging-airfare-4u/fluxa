## Why

当前内测阶段需要一种低成本、可控的会员激励方式，帮助定向发放 Pro 体验权益并提升新用户激活率。邀请码兑换固定会员时长可以在不改动支付主流程的前提下快速上线，且便于风控与追踪。

## What Changes

- 新增邀请码兑换能力：支持用户通过邀请码领取固定权益（Pro 30 天）。
- 注册流程新增“邀请码（选填）”输入，注册时仅保存待兑换信息，不立即消耗邀请码。
- 用户首次进入 `/app` 时自动尝试兑换待处理邀请码；失败不阻塞使用。
- 个人页新增手动兑换入口，作为自动兑换失败或漏填邀请码时的兜底路径。
- 新增邀请码状态与兑换审计记录，确保“一码一次”与“单用户限领一次”约束可验证。
- 新增受控服务端兑换接口（API/RPC），统一错误码与返回语义，避免前端直连敏感表。

## Capabilities

### New Capabilities
- `invite-code-membership-reward`: 管理邀请码生命周期并将有效邀请码兑换为固定会员权益（Pro 30 天），包含自动兑换与手动兑换两条路径。

### Modified Capabilities
- `cn-web-payments`: 扩展会员授予来源语义与记录方式，使非支付来源（邀请码）授予的会员权益可被一致追踪与审计。

## Impact

- Affected code:
  - `src/app/auth/page.tsx`（注册页选填邀请码）
  - `src/components/auth/AuthDialog.tsx`（弹窗注册选填邀请码）
  - `src/app/app/layout.tsx`（登录后自动兑换触发）
  - `src/app/app/profile/page.tsx`（手动兑换入口）
  - 新增/修改邀请码相关 API route 与 Supabase 查询层
- Affected data layer:
  - 新增邀请码与兑换审计表
  - 新增兑换 RPC（事务化与并发控制）
  - 可能扩展现有会员来源记录字段语义（与 `user_profiles` 会员到期字段协同）
- APIs:
  - 新增邀请码兑换接口（服务端）
  - 统一返回兑换结果与错误码（如无效、已使用、已过期、已领过）
- Security/operations:
  - 邀请码按哈希存储，防止明文泄露
  - 通过 RLS + 受控 RPC/API 防止批量枚举与越权访问
  - 支持后续运营审计与内测效果分析（兑换记录可追溯）
