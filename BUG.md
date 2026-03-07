# 支付流程问题排查记录

## 结论
当前支付流程存在**已确认问题**与**高概率潜在问题**，尚未达到生产可用状态。

---

## 一、已确认问题（代码可直接定位）

### 1) 下单/查单接口鉴权链路不一致，存在 401 风险
- 前端请求未显式携带 `Authorization`：
  - `src/components/pricing/CheckoutDialog.tsx:93`（POST `/api/payments/checkout`）
  - `src/components/pricing/CheckoutDialog.tsx:122`（GET `/api/payments/orders/${orderNo}`）
- 后端要求 `authorization` header：
  - `src/lib/supabase/server.ts:21`（`request.headers.get('authorization')`）
- 影响：可能导致下单/查单直接返回 401，支付流程中断。

### 2) 支付入口在页面层被关闭
- `src/app/pricing/page.tsx:17` 写死：`const [paymentEnabled] = useState(false);`
- 同文件 `:110` 将该值传给 `Pricing`。
- 影响：付费入口可能长期不可用，导致用户无法发起正常支付。

### 3) 回调地址使用相对路径
- `src/lib/payments/index.ts:97`：`notifyUrl: /api/payments/notify/${provider}`
- 影响：多数支付平台需要可公网访问的绝对 URL；相对路径在真实回调场景下通常不可用。

### 4) 渠道级 mode 配置未真正生效
- 配置结构定义了渠道 mode：
  - `src/lib/supabase/queries/settings.ts:35`（`PaymentChannelsSetting`）
- 下单时实际只读全局 env：
  - `src/lib/payments/index.ts:67`（`getPaymentEnv()`）
- 影响：无法实现“支付宝生产、微信沙箱”这类按渠道灰度。

### 5) 支付适配器仍是 mock 级实现
- 支付宝：`src/lib/payments/providers/alipay/adapter.ts:33`
- 微信：`src/lib/payments/providers/wechat/adapter.ts:34`
- 特征：返回 mocked order id / mocked sign / 模拟 URL；验签逻辑也非完整生产实现。
- 影响：不适合直接上线真实收款。

---

## 二、高概率潜在问题（需进一步验证）

### 6) 价格页未看到统一读取后端支付开关
- 页面内开关是本地状态写死，而非读取 `system_settings`。
- 可能导致“后端已开、前端仍关”或“灰度策略前后不一致”。

### 7) 测试覆盖偏 contract，真实链路覆盖不足
- 当前支付相关测试主要检查“代码包含某字符串/契约存在”，例如：
  - `tests/payments/api-routes-contract.test.ts`
  - `tests/payments/checkout-dialog-contract.test.ts`
- 可能遗漏：真实鉴权 header 传递、回调可达性、端到端支付成功路径。

### 8) webhook 安全与幂等在真实流量下仍需压测/联调验证
- 虽有幂等函数与事件去重（`payment_fulfill_order`），但需要真实平台回调验证边界：
  - 重复回调、乱序回调、金额不一致、签名异常、并发写入。

---

## 三、建议的排查优先级

1. **先打通阻断项**：鉴权链路（401）+ 前端支付入口开关。
2. **再做可上线项**：notify 绝对 URL + 渠道级 mode 真正生效。
3. **最后做上线验证**：真实沙箱联调 + 端到端测试 + webhook 异常场景压测。

---

## 四、补充说明

以上结论来自当前代码静态检查与支付相关测试现状；
建议在修复后补一轮真实沙箱联调再评估“生产可用”。
