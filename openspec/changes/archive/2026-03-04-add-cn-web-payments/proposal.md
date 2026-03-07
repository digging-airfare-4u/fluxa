## Why

Fluxa 已经具备会员定价页、积分体系和 `payment_enabled` 开关，但当前仓库没有任何可上线的支付链路，且历史 PRD 假设了 Stripe，不适合中国大陆个体工商户的网站收款场景。需要基于现有会员与积分模型，设计一套面向中国网站的支付方案，让付费转化、积分补充和后续对账/退款具备可实施路径。

## What Changes

- 为网站场景引入国内支付能力，首期覆盖支付宝和微信网站支付路径，并预留银联/银行卡通道扩展位。
- 新增统一支付域模型，覆盖商品、订单、支付尝试、异步通知、退款与对账记录，而不是把支付状态散落在前端页面参数里。
- 将现有定价页从“静态按钮跳转”升级为真实下单流程，并与 `payment_enabled`、渠道可用性和会员权益履约联动。
- 统一支付成功后的履约语义，确保 `user_profiles`、积分流水、前端余额展示与后端 AI 权限判断读到同一份会员状态。

## Capabilities

### New Capabilities
- `cn-web-payments`: 为 Fluxa 提供中国网站支付能力，包括下单、渠道选择、异步通知、履约、退款和对账。

### Modified Capabilities
（无）

## Impact

- 前端：`src/app/pricing/page.tsx`、`src/components/pricing/Pricing.tsx`、点数/会员展示与余额刷新入口。
- 服务端：新增 Next.js 支付 API routes、支付服务层、通知验签与对账逻辑。
- 数据：新增支付商品/订单/退款/通知表，并扩展 `user_profiles` 与 `point_transactions` 的履约字段。
- 运行约束：替换 Stripe 假设，改为中国网站支付的渠道矩阵与商户配置管理。
