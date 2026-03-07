# CN Web Payments Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复支付链路中的高风险正确性与安全问题，并补齐关键行为测试，使支付改动达到可合并标准。

**Architecture:** 采用“先测后改”的小步迭代：先补行为级失败测试，再做最小实现修复。优先处理配置模型一致性、服务端强校验、RPC 权限收敛与通知验签，再处理文档和前端外部依赖。所有改动围绕现有 `src/lib/payments/*`、`src/app/api/payments/*` 与 Supabase migration 进行，不引入额外抽象。

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase(Postgres + RLS + RPC), Vitest, pnpm。

---

### Task 1: 统一 `payment_channels` 配置模型（P0）

**Files:**
- Modify: `supabase/migrations/20260304101000_cn_web_payments_flags.sql`
- Modify: `src/lib/payments/channels.ts`
- Test: `tests/lib/payments/channels.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/payments/channels.test.ts
import { describe, it, expect } from 'vitest';
import { getAvailableChannels } from '@/lib/payments/channels';

it('returns scene-filtered channels when config includes channel-level scenes', async () => {
  // mock service client to return { alipay_page: { enabled: true, scenes: ['desktop'] } ... }
  // expect desktop scene includes alipay_page
});

it('does not throw when config is provider-level legacy shape', async () => {
  // mock legacy: { alipay: { enabled: true, mode: 'sandbox' }, wechat: {...} }
  // expect function resolves to [] or normalized result; never throws
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/lib/payments/channels.test.ts`
Expected: FAIL（当前 legacy shape 下 `cfg.scenes.includes` 路径会失败或行为不符）

**Step 3: Write minimal implementation**

```ts
// src/lib/payments/channels.ts
// 1) 统一迁移默认值为 channel-level key：alipay_page/wechat_native/wechat_jsapi/unionpay
// 2) loadChannelsConfig 里增加 normalize：兼容 legacy provider-level 数据
// 3) 过滤前做数组保护：Array.isArray(cfg.scenes)
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/lib/payments/channels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260304101000_cn_web_payments_flags.sql src/lib/payments/channels.ts tests/lib/payments/channels.test.ts
git commit -m "fix(payments): align channel config shape and add legacy-safe normalization"
```

---

### Task 2: Checkout 增加服务端 `payment_enabled` 强校验（P0）

**Files:**
- Modify: `src/app/api/payments/checkout/route.ts`
- Test: `tests/payments/checkout-route.behavior.test.ts`

**Step 1: Write the failing test**

```ts
// tests/payments/checkout-route.behavior.test.ts
it('returns PAYMENT_DISABLED when global payment switch is off', async () => {
  // mock system_settings.payment_enabled = { enabled: false }
  // POST /api/payments/checkout
  // expect 403 + { error: { code: 'PAYMENT_DISABLED' } }
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/payments/checkout-route.behavior.test.ts`
Expected: FAIL（当前路由未检查全局开关）

**Step 3: Write minimal implementation**

```ts
// src/app/api/payments/checkout/route.ts
// 在 createOrder 前读取 system_settings(key='payment_enabled')
// enabled !== true 时返回 403 + PAYMENT_DISABLED
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/payments/checkout-route.behavior.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/payments/checkout/route.ts tests/payments/checkout-route.behavior.test.ts
git commit -m "fix(payments): enforce server-side global payment switch on checkout"
```

---

### Task 3: 收敛 `payment_fulfill_order` / `payment_mark_order_expired` 执行权限（P0）

**Files:**
- Modify: `supabase/migrations/20260304104000_cn_web_payments_rpcs.sql`
- Test: `tests/payments/payments-rpc-security-contract.test.ts`

**Step 1: Write the failing test**

```ts
// tests/payments/payments-rpc-security-contract.test.ts
import { readFileSync } from 'node:fs';

it('revokes public execute for payment security definer RPCs', () => {
  const sql = readFileSync('supabase/migrations/20260304104000_cn_web_payments_rpcs.sql', 'utf8');
  expect(sql).toContain('REVOKE ALL ON FUNCTION payment_fulfill_order');
  expect(sql).toContain('REVOKE ALL ON FUNCTION payment_mark_order_expired');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/payments/payments-rpc-security-contract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```sql
-- supabase/migrations/20260304104000_cn_web_payments_rpcs.sql
REVOKE ALL ON FUNCTION payment_fulfill_order(TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION payment_mark_order_expired(TEXT) FROM PUBLIC, anon, authenticated;
-- 如需要，显式 GRANT 给 service_role
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/payments/payments-rpc-security-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260304104000_cn_web_payments_rpcs.sql tests/payments/payments-rpc-security-contract.test.ts
git commit -m "fix(payments): restrict execute privileges on security-definer RPCs"
```

---

### Task 4: 补齐微信通知签名校验（P1）

**Files:**
- Modify: `src/lib/payments/adapters/wechat.ts`
- Test: `tests/lib/payments/wechat-notify-verify.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects notification when required WeChat signature headers are missing', async () => {
  // headers missing wechatpay-signature/serial/timestamp/nonce
  // expect valid === false
});

it('rejects notification when timestamp is outside replay window', async () => {
  // old timestamp
  // expect valid === false
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/lib/payments/wechat-notify-verify.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/lib/payments/adapters/wechat.ts
// 1) verifyNotification 使用 headers 参数
// 2) 校验必需 header
// 3) 校验 timestamp 窗口（例如 ±5min）
// 4) 验签失败直接 valid=false；通过后再解密 resource
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/lib/payments/wechat-notify-verify.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/payments/adapters/wechat.ts tests/lib/payments/wechat-notify-verify.test.ts
git commit -m "fix(payments): enforce wechat notification signature and replay checks"
```

---

### Task 5: 下单写入商品快照（P1）

**Files:**
- Modify: `src/lib/payments/order-service.ts`
- Test: `tests/lib/payments/order-service.snapshot.test.ts`

**Step 1: Write the failing test**

```ts
it('stores immutable product snapshot in payment order metadata', async () => {
  // createOrder 后断言 metadata.product_snapshot 包含 code/title/amount_fen/currency/kind/duration_days/points_grant
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/lib/payments/order-service.snapshot.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/lib/payments/order-service.ts
metadata: {
  channel: input.channel,
  scene: input.scene,
  scene_metadata: input.scene_metadata ?? {},
  product_snapshot: {
    code: typedProduct.code,
    title: typedProduct.title,
    amount_fen: typedProduct.amount_fen,
    currency: typedProduct.currency,
    kind: typedProduct.kind,
    duration_days: typedProduct.duration_days,
    points_grant: typedProduct.points_grant,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/lib/payments/order-service.snapshot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/payments/order-service.ts tests/lib/payments/order-service.snapshot.test.ts
git commit -m "fix(payments): persist immutable product snapshot in order metadata"
```

---

### Task 6: 仅允许 Header 传递 cron secret（P1）

**Files:**
- Modify: `src/app/api/payments/cron/route.ts`
- Modify: `docs/payments-ops-guide.md`
- Test: `tests/payments/cron-route.auth.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects query param secret and only accepts x-cron-secret header', async () => {
  // POST /api/payments/cron?secret=...
  // expect 401
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/payments/cron-route.auth.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/app/api/payments/cron/route.ts
const secret = request.headers.get('x-cron-secret');
// remove searchParams.get('secret') fallback
```

并同步文档，移除：
- `docs/payments-ops-guide.md` 中 `?secret=YOUR_SECRET` 示例。

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/payments/cron-route.auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/payments/cron/route.ts docs/payments-ops-guide.md tests/payments/cron-route.auth.test.ts
git commit -m "fix(payments): require cron secret via header only"
```

---

### Task 7: 将关键支付测试从字符串契约升级为行为测试（P2）

**Files:**
- Modify: `tests/payments/api-routes-contract.test.ts`
- Modify: `tests/payments/checkout-dialog-contract.test.ts`
- Modify: `tests/payments/payments-rpc-idempotency-contract.test.ts`
- Create: `tests/payments/api-routes.behavior.test.ts`

**Step 1: Write failing behavior tests**

```ts
it('checkout returns CHANNEL_UNAVAILABLE for disabled scene/channel', async () => {
  // mock channel config + request scene
  // expect 400 CHANNEL_UNAVAILABLE
});

it('notify handler is idempotent on duplicate provider event id', async () => {
  // same provider_event_id twice
  // expect second response indicates idempotent duplicate
});
```

**Step 2: Run tests to verify failures**

Run: `pnpm vitest --run tests/payments/api-routes.behavior.test.ts`
Expected: FAIL

**Step 3: Keep minimal contract tests, move critical assertions to behavior tests**

```ts
// 保留少量“文件存在/导出存在”契约
// 业务正确性全部迁移到行为测试
```

**Step 4: Run test suite**

Run: `pnpm vitest --run tests/payments`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/payments/api-routes-contract.test.ts tests/payments/checkout-dialog-contract.test.ts tests/payments/payments-rpc-idempotency-contract.test.ts tests/payments/api-routes.behavior.test.ts
git commit -m "test(payments): replace fragile source-string contracts with behavior tests"
```

---

### Task 8: 前端二维码改为本地生成（P2）

**Files:**
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Optionally Modify: `package.json`（如需引入本地二维码库）
- Test: `tests/payments/checkout-dialog-qr.test.ts`

**Step 1: Write the failing test**

```ts
it('renders QR without third-party URL dependency', () => {
  // assert component no longer uses api.qrserver.com
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/payments/checkout-dialog-qr.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// 使用本地 QR 生成方式（前端库）
// 删除 https://api.qrserver.com/v1/create-qr-code 依赖
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/payments/checkout-dialog-qr.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pricing/CheckoutDialog.tsx package.json tests/payments/checkout-dialog-qr.test.ts
git commit -m "fix(payments): render QR locally without external data leak"
```

---

### Final Verification Task

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run: `pnpm vitest --run tests/lib/payments tests/payments`
Expected: PASS

**Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS

**Step 3: Quick manual API checks**

Run (示例):
- `POST /api/payments/channels?scene=desktop`
- `POST /api/payments/checkout` (payment_enabled=false)
- `POST /api/payments/cron` (header/no-header)
Expected:
- channels 正常
- checkout 返回 PAYMENT_DISABLED
- cron 无 header 为 401

**Step 4: Commit verification-only notes（可选）**

```bash
git status
```

