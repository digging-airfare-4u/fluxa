## Context

Fluxa 当前已经有会员定价页、积分余额、交易记录和 `payment_enabled` 总开关，但定价信息仍部分硬编码在前端，实际支付链路尚未落地。历史 `docs/membership-points-prd.md` 将支付实现假定为 Stripe webhook，而当前目标用户主体是中国大陆个体工商户，网站支付更适合支付宝、微信和后续银联路径。

现有项目约束：
- `src/app/pricing/page.tsx` 与 `src/components/pricing/Pricing.tsx` 已承担公开定价展示，但没有真实 checkout。
- `user_profiles`、`point_transactions`、`membership_configs` 已经支撑积分与权益展示。
- 前端余额与等级展示实时订阅 `user_profiles`，但 `supabase/functions/_shared/services/auth.ts` 仍尝试从 `memberships` 表读取等级，存在会员状态来源分裂。
- `payment_enabled` 已作为系统设置存在，适合扩展为“是否开放收款”和“开放哪些渠道”的运行开关。

## Goals / Non-Goals

**Goals:**
- 为 Fluxa 的网站定价页提供可上线的国内支付设计，优先支持支付宝、微信，预留银联扩展位。
- 引入统一支付订单生命周期，支持下单、异步通知、查单、退款、对账和幂等履约。
- 让支付成功后的会员与积分更新复用现有 `user_profiles` / `point_transactions` / Realtime 展示链路。
- 消除当前“前端看 `user_profiles`、后端权限看 `memberships`”的会员状态不一致问题。

**Non-Goals:**
- 不设计 App 原生支付流程。
- 不在本次设计中引入发票、税务或企业级财务后台。
- 不把 Team 套餐默认改成自助购买；若仍需销售介入，保持联系销售路径。
- 不把微信 H5 外部浏览器支付作为首发主路径。

## Decisions

1. **支付编排放在 Next.js Route Handlers，不放在 Supabase Edge Functions**
   - 选择：新增 `src/app/api/payments/*` 作为下单、状态查询、通知回调和退款入口，使用 Node runtime 处理签名验签、证书和原始请求体。
   - 理由：支付通知验签、HTML form 跳转、二维码链接、证书/密钥管理更适合 Next.js 服务器环境；也更贴近现有定价页和 Web 体验。
   - 备选：
     - Supabase Edge Functions：适合轻量 API，但在国内支付证书/签名与原始 body 处理上会增加 Deno 适配复杂度。

2. **新增独立支付商品表，不再把价格硬编码在 `transformToPricingPlans`**
   - 选择：新增 `payment_products`，承载销售产品（如 `pro-monthly`、`pro-yearly`、未来 `points-1000`），字段包含 `code`、`kind`、`target_level`、`duration_days`、`points_grant`、`amount_fen`、`currency`、`is_self_serve`、`is_enabled`、`display_config`。
   - 理由：当前 `membership_configs` 负责权益，不适合继续承担价格、账期、渠道可售性；独立商品表更适合后续点数包与渠道灰度。
   - 备选：
     - 扩展 `membership_configs`：会把权益与销售商品耦合，无法优雅表示月付/年付/点数包等多个 SKU。

3. **统一支付域模型，建立订单与通知审计闭环**
   - 选择：新增 `payment_orders`、`payment_attempts`、`payment_webhook_events`、`payment_refunds` 四类核心表。
   - 理由：当前项目已有积分流水，但没有支付可追踪链路；必须用订单域模型支撑幂等、支持查单、重复通知、退款与人工排障。
   - 备选：
     - 直接把支付结果写进 `point_transactions`：会丢失支付阶段信息，无法表达 pending、expired、refund_pending 等中间状态。

4. **会员状态以 `user_profiles` 为运行时快照，支付履约同步写入；后端废弃对 `memberships` 的依赖**
   - 选择：扩展 `user_profiles`，增加 `membership_expires_at`、`membership_source_order_id`、`membership_updated_at` 等字段，并让支付履约和 AI 权限判断统一读取这里。
   - 理由：前端现有余额、等级、Realtime 都依赖 `user_profiles`；把它作为运行时快照可以最小化改动并修复当前权限判断的不一致。
   - 备选：
     - 保留 `memberships` / `user_profiles` 双写：会继续制造分裂来源和对账复杂度。
     - 新增独立 `membership_entitlements` 作为唯一源：结构更纯，但首期会增加更多迁移和订阅改造成本。

5. **渠道矩阵采用“按场景选择”，不是所有浏览器统一暴露同一种微信支付**
   - 选择：
     - 支付宝作为通用网站主通道，覆盖 PC 和手机浏览器。
     - 微信支付在桌面浏览器优先走 Native 二维码；仅在微信内置浏览器且已配置公众号/AppID 时开放 JSAPI。
     - 银联/银行卡通过独立适配器接入，但默认作为 feature-flagged 第二阶段渠道。
   - 理由：这与当前中国个体户网站收款路径最匹配，也能避免把首发体验押在通用 H5 微信支付上。
   - 备选：
     - 首发就做所有微信场景 + 银联：范围过大，证书和回调链路复杂度明显升高。

6. **支付成功后的履约必须是幂等事务，并与积分流水联动**
   - 选择：实现统一履约服务或数据库 RPC，单次结算内完成订单状态迁移、会员等级更新、点数发放、`point_transactions` 写入和 Realtime 可见的快照更新。
   - 理由：当前项目已经把积分作为关键状态；支付履约如果拆成多次普通更新，容易出现已支付但没加点、已升级但未刷新权限的中间态。
   - 备选：
     - 回调里串行调用多个 repository：实现简单，但幂等性和失败恢复风险更高。

7. **定价页改成“拉商品配置 + 场景化 Checkout”，而不是前端 href 跳转**
   - 选择：保留现有展示结构，但 CTA 改为打开 checkout 弹层/页面，由后端返回可用渠道、订单号、支付跳转/二维码参数，再由前端轮询订单状态。
   - 理由：当前 `Pricing` 组件和 `payment_enabled` 已经是入口；在此基础上引入真正的 checkout，能最小化 UI 重做。
   - 备选：
     - 每个渠道单独新页面：逻辑分散，难以统一会员履约与失败处理。

## Risks / Trade-offs

- **[Risk] 当前会员状态来源不一致会拖慢支付落地** → **Mitigation**: 在支付改造第一阶段先统一到 `user_profiles`，并给后端权限读取增加兼容迁移窗口。
- **[Risk] 微信 JSAPI 依赖额外公众号/AppID 资质** → **Mitigation**: 首发不把 JSAPI 作为阻塞项，桌面优先 WeChat Native，移动端先提供支付宝。
- **[Risk] 国内支付渠道通知重试频繁，容易重复履约** → **Mitigation**: 为 webhook event id、provider transaction id 和本地 order no 建唯一约束，所有履约只走幂等结算入口。
- **[Risk] 银联接入会显著扩大首期范围** → **Mitigation**: 在订单模型中预留 `unionpay` 适配器和展示开关，但默认不开启，第二阶段再验收。
- **[Risk] 当前 pricing 价格硬编码，变更渠道后容易前后端金额不一致** → **Mitigation**: 定价 UI 改为服务端商品配置驱动，前端只展示后端返回的价格快照。

## Migration Plan

1. 新增支付相关数据表与 `user_profiles` 扩展字段，补齐索引、RLS 和系统设置中的渠道开关。
2. 实现支付服务层与渠道适配器，但先在沙箱环境跑通，不暴露前端入口。
3. 改造后端会员读取逻辑，统一以 `user_profiles` 作为当前等级快照来源。
4. 改造定价页为真实 checkout，先启用支付宝和微信 Native，保留 Team 联系销售路径。
5. 增加支付成功后的 Realtime/主动刷新联动，确保 profile、pricing、insufficient-points 路径都能看到最新状态。
6. 启用退款、查单、超时关闭和人工对账脚本，之后再按开关启用银联通道。
7. 回滚策略：关闭 `payment_enabled` 和各渠道开关，保留订单数据但停止新订单创建，履约后的会员/点数不回退，未支付订单由定时任务关闭。

## Open Questions

- 首发是否只开放 `pro` 自助购买，`team` 继续保持销售介入；本设计默认如此。
- 微信 JSAPI 所需的公众号/AppID 是否会在首发前准备好；若没有，则移动端首期仅开放支付宝。
- 银联/银行卡是要首发上线还是保留为第二阶段能力；本设计默认预留表结构和适配接口，但不开启入口。
