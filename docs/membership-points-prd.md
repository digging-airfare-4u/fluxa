# Product Requirements Document: 会员点数体系

**Version**: 1.0  
**Date**: 2025-03-01  
**Author**: Sarah (Product Owner)  
**Quality Score**: 92/100

---

## Executive Summary

为 Fluxa 增加会员点数体系，驱动留存与付费转化。用户可选择会员等级（基础/Plus/Pro/Max），通过每日登录获取点数并在 AI 生成、导出、优先处理时消费点数；付费会员获得更高上限、礼包和权益。点数和规则在后台可配置，所有交易可审计，支付通过 Stripe 完成，余额变化实时同步前端。

---

## Problem Statement

**Current Situation**: 平台核心体验已上线（AI 设计 + 画布），缺少增长与付费杠杆；用户缺乏明确的消耗/奖励机制，留存和变现空间不足。  
**Proposed Solution**: 引入会员等级与点数体系：登录获点、消耗点数使用关键功能、付费会员享受更高额度和权益，后台可配置规则。  
**Business Impact**: 提升日活（每日登录奖励）、提高付费转化（升级/套餐）、增加使用深度（点数消耗驱动功能体验），并为后续营销活动提供可调节的运营工具。

---

## Success Metrics

- DAU/7day 登录率提升（目标 +15%）  
- 会员付费转化率（注册→付费）提升（目标 +8%）  
- 关键功能使用频次：AI 生成调用数、导出次数提升（目标 +20%）  
- 支付成功率与风控：支付 webhook 成功处理率 > 99%，异常/重复扣减率 < 0.1%

---

## User Personas

### 内容创作者（Primary）
- **Role**: 个体创作者/营销人员  
- **Goals**: 快速生成社交/营销视觉  
- **Pain Points**: 预算有限，需要清晰的额度与成本  
- **Technical Level**: 中

### 设计师/小团队（Secondary）
- **Role**: 设计师或小团队成员  
- **Goals**: 更高质量、批量生成、优先队列  
- **Pain Points**: 效率与可预测的性能  
- **Technical Level**: 中高

---

## User Stories & Acceptance Criteria

### Story 1: 登录赚取点数
**As a** 任何登录用户  
**I want to** 每日登录自动获得点数  
**So that** 我能继续体验核心功能  
**Acceptance Criteria**:  
- [ ] 登录成功后自动发放当日奖励（基础 100 点，Plus 150，Pro 200，Max 300，可配置）  
- [ ] 当日重复登录不重复发放（幂等）  
- [ ] UI 显示今日奖励状态与下一次可领时间  
- [ ] 点数变更实时刷新余额

### Story 2: 消耗点数使用功能
**As a** 登录用户  
**I want to** 在生成/导出/优先处理前看到所需点数并完成扣减  
**So that** 我能可预期地使用功能  
**Acceptance Criteria**:  
- [ ] 生成/导出/优先处理前显示消耗点数（默认 -20/-50/-30，付费会员可设折扣价，可配置）  
- [ ] 点数不足时弹窗提示升级（Plus/Pro/Max）或继续积累  
- [ ] 扣减失败时功能不执行且提示原因  
- [ ] 扣减、功能执行、记录写入是一个事务（成功才扣减）

### Story 3: 查看余额与历史
**As a** 用户  
**I want to** 查看我的点数余额、每日上限、交易历史  
**So that** 我能掌握消耗和奖励来源  
**Acceptance Criteria**:  
- [ ] 个人中心展示：当前等级、余额、每日上限、今日已获取/消耗  
- [ ] 交易历史列出 earn/spend/adjust，含时间、来源、金额、关联订单  
- [ ] 历史可分页/按类型过滤  
- [ ] 实时更新余额和列表（订阅）

### Story 4: 升级会员
**As a** 免费用户  
**I want to** 选择套餐并支付升级为 Plus/Pro/Max  
**So that** 获得更多点数和权益  
**Acceptance Criteria**:  
- [ ] 套餐页展示各等级价格、权益、每日上限、赠送礼包（礼包值可配置）  
- [ ] 支付通过 Stripe，成功后幂等更新 membership_level、点数、权益开关  
- [ ] 支付异常时不变更等级，提示失败原因  
- [ ] 升级后立即刷新前端显示

---

## Functional Requirements

### 核心能力
**Earn 点数**  
- 每日登录奖励：基础 100 点，Plus 150，Pro 200，Max 300（可配置）；每日获取上限：基础 200，Plus 400，Pro 800，Max 1200（可配置）。  
- 后台可调整等级奖励、每日上限、礼包数值（规则表/配置表）。  
- 防刷：按 user_id + 日期 幂等键；IP/设备/速率限制。

**Spend 点数**  
- 默认消耗：生成 -20，导出 -50，优先处理 -30；付费会员可折扣价（如 Plus -18，Pro -16，Max -14，均可配置）。  
- 扣减需与功能执行同事务；失败回滚并提示。

**Membership 管理**  
- 等级：基础/Plus/Pro/Max；字段含 membership_level、points、daily_cap、perks、next_reset_at。  
- 支付：前端发起 → Stripe → webhook 验证签名 → 更新用户与记录表 → 实时推送前端。  
- 配置化：等级权益、点数赠送、折扣、礼包均可后台调节。

**交易记录与审计**  
- 记录表：earn/spend/adjust，来源（login/purchase/usage/admin），点数变化，关联订单/操作 ID，时间戳，操作者。  
- 管理后台：查询、导出、管理员调账（需 admin 角色）。

### Out of Scope（首版不做）
- 团队共享额度  
- 点数包单次充值（不改等级）  
- 连续登录加成、衰减、活动奖励  
- 非 Stripe 的支付渠道

---

## Technical Constraints

- **性能/事务**: Earn/Spend 采用 Supabase RPC/事务，保证幂等与原子性；目标 API 响应 < 200ms。  
- **安全/RLS**: 全部点数与会员数据表按 user_id RLS；管理接口需 admin 角色。  
- **支付可信**: 仅以 Stripe webhook（签名校验、幂等）触发等级/点数变更。  
- **风控**: 登录奖励防刷（幂等键 + 速率限制 + 可选 IP/设备检查）；Spend 接口限频。  
- **实时性**: Supabase Realtime 订阅用户点数/等级变更，前端即时刷新。  
- **审计**: 所有变更写交易记录表；管理员调账需记录操作者和备注。  
- **可配置性**: 等级权益、每日奖励、上限、折扣、礼包由配置表/后台 UI 可调，默认值随环境加载。

---

## MVP Scope & Phasing

### Phase 1 (MVP)
- 登录奖励发放（含防刷、上限）  
- 功能消耗扣减（生成/导出/优先处理）  
- 会员升级（Stripe 支付 + webhook 幂等更新）  
- 交易记录与实时余额更新  
- 个人中心展示余额、等级、历史

### Phase 2 (Enhancements)
- 套餐 A/B（价格、折扣、礼包可试验）  
- 余额不足的推荐与动态优惠  
- 运营配置后台（非 SQL 配置化界面）

### Future Considerations
- 营销活动奖励（任务/活动赠送）  
- 多渠道支付  
- 团队共享额度

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Webhook 重复/延迟 | 中 | 高 | Stripe 幂等键，事务更新，重试安全 |
| 并发扣减导致负数 | 中 | 高 | 数据库层事务 + 检查余额 >= 消耗 |
| 作弊刷登录奖励 | 中 | 中 | 幂等键 + 速率限制 + 异常报警 |
| 实时订阅丢失事件 | 低 | 中 | 前端定期拉取兜底，断线重连 |

---

## Dependencies & Blockers

**Dependencies**  
- Stripe 支付/订阅配置  
- Supabase RLS 与 RPC/事务支持  
- 前端状态订阅（Supabase Realtime）

**Blockers**  
- Stripe Webhook 公网可达与签名校验未配置则无法上线付费

---

## Appendix

**术语**  
- Earn：点数增加来源（登录、礼包、调账）  
- Spend：点数消耗（功能使用）  
- Adjust：管理员调整  
- Perks：与等级绑定的权益标志位（去水印、优先队列等）
