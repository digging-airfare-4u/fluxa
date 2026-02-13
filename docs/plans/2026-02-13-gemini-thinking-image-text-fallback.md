# Gemini Native Thinking + Image/Text Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Gemini native 模式下，稳定支持三种结果：`图片`、`文本+思考`、`错误`，并保证前端都能正确展示。

**Architecture:** 后端先统一结果契约（image/text/error 三态），provider 只负责解析，`generate-image` 负责策略（重试、扣点、job 状态）。前端只消费统一 `job.output`，按 `output.kind` 渲染消息与图片。最终用结构化日志和测试矩阵保障回归。

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), Next.js 16 + React 19, Zustand, Vitest, Supabase Realtime

---

### Task 1: 统一输出契约（后端与前端共享）

**Files:**
- Modify: `supabase/functions/_shared/types/index.ts`
- Modify: `src/lib/realtime/subscribeJobs.ts`
- Modify: `src/hooks/chat/useGeneration.ts`

**Step 1: 写失败用例（类型层）**

新增类型断言文件（建议）：
- Create: `tests/types/image-job-output-contract.test.ts`

```ts
import { expectTypeOf, test } from 'vitest';

type ImageJobOutput =
  | { kind: 'image'; publicUrl: string; op: unknown }
  | { kind: 'text'; textResponse: string; thoughtSummary?: string }
  | { kind: 'error'; message: string };

test('image job output contract', () => {
  expectTypeOf<ImageJobOutput>().toBeObject();
});
```

**Step 2: 运行并确认当前没有契约保护（预期 RED）**

Run: `pnpm test tests/types/image-job-output-contract.test.ts`  
Expected: 当前仓库无该类型约束，后续任务补齐。

**Step 3: 最小实现**

在 `supabase/functions/_shared/types/index.ts` 增加：

```ts
export type ImageGenerationJobOutput =
  | {
      kind: 'image';
      assetId: string;
      storagePath: string;
      publicUrl: string;
      layerId: string;
      op: JobOutput['op'];
      model: string;
      resolution?: string;
      aspectRatio?: string;
      textResponse?: string;
      thoughtSummary?: string;
    }
  | {
      kind: 'text';
      model: string;
      resolution?: string;
      aspectRatio?: string;
      textResponse: string;
      thoughtSummary?: string;
      providerCode?: string;
    }
  | {
      kind: 'error';
      message: string;
      providerCode?: string;
    };
```

前端 `useGeneration` 只按 `kind` 分支读取字段，不再靠可选字段猜测。

**Step 4: 运行验证（GREEN）**

Run: `pnpm test tests/types/image-job-output-contract.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/_shared/types/index.ts src/lib/realtime/subscribeJobs.ts src/hooks/chat/useGeneration.ts tests/types/image-job-output-contract.test.ts
git commit -m "refactor: unify image job output contract"
```

---

### Task 2: Gemini native 解析强化（图片、文本、思考）

**Files:**
- Modify: `supabase/functions/_shared/providers/gemini.ts`
- Test: `supabase/functions/_shared/providers/gemini.native.parse.test.ts`

**Step 1: 写失败用例（RED）**

覆盖 4 个输入：
1. `parts[].inlineData`（camelCase）  
2. `parts[].inline_data`（snake_case）  
3. 仅文本 + `thought` + `thoughtSignature`  
4. 文本里嵌入 `data:image/...;base64,...`

```ts
Deno.test('parseNativeResponse returns TEXT_ONLY_RESPONSE for text-only candidate', () => {
  // arrange
  // act + assert ProviderError.providerCode === 'TEXT_ONLY_RESPONSE'
});
```

**Step 2: 运行并确认失败**

Run: `deno test supabase/functions/_shared/providers/gemini.native.parse.test.ts`  
Expected: FAIL（当前分支至少一个 case 不支持）

**Step 3: 最小实现**

保留当前“先聚合 text/thought，再找 image”的逻辑，补齐：
- 对 `candidate.finishReason` 结构化记录到 metadata
- `thoughtSignatures` 长度保护（避免日志过大）
- `textResponse` 超长截断（例如 4k）并记录 `truncated=true`

**Step 4: 运行测试**

Run: `deno test supabase/functions/_shared/providers/gemini.native.parse.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/_shared/providers/gemini.ts supabase/functions/_shared/providers/gemini.native.parse.test.ts
git commit -m "feat: harden gemini native response parsing"
```

---

### Task 3: 文本-only 自动重试策略（提升出图率）

**Files:**
- Modify: `supabase/functions/_shared/providers/gemini.ts`
- Modify: `supabase/functions/generate-image/index.ts`

**Step 1: 写失败用例（RED）**

新增场景：第一次 `TEXT_ONLY_RESPONSE`，第二次请求要求 `IMAGE` only 并成功返回图像。

**Step 2: 最小实现**

在 `generate-image` 添加一次受控重试：
- 触发条件：`providerCode === 'TEXT_ONLY_RESPONSE'`
- 第二次请求参数：
  - `responseModalities: ['IMAGE']`
  - prompt 附加约束：`Return image output only. Do not return explanatory text.`
- 若第二次仍 text-only：落回 `kind: 'text'`

**Step 3: 验证**

Run: `deno test supabase/functions/generate-image/retry-text-only.test.ts`  
Expected: PASS

**Step 4: Commit**

```bash
git add supabase/functions/_shared/providers/gemini.ts supabase/functions/generate-image/index.ts supabase/functions/generate-image/retry-text-only.test.ts
git commit -m "feat: retry gemini text-only responses with image-only mode"
```

---

### Task 4: 前端统一渲染（图片优先，文本兜底，思考可折叠）

**Files:**
- Modify: `src/hooks/chat/useGeneration.ts`
- Modify: `src/components/chat/ChatMessage.tsx`
- Modify: `src/lib/supabase/queries/messages.ts`
- Modify: `src/locales/zh-CN/chat.json`
- Modify: `src/locales/en-US/chat.json`

**Step 1: 写失败用例（RED）**

Create: `tests/components/chat-message-rendering.test.tsx`

覆盖：
1. `kind=image` 显示图片卡片  
2. `kind=text` 显示 `content`  
3. `metadata.thinking` 显示“查看思考过程”

**Step 2: 最小实现**

`useGeneration` 中：
- done + image: 渲染图片并可附带文本  
- done + text: 不触发画布 op，仅替换 pending 为 assistant 文本  
- failed: 显示错误消息并可重试

`ChatMessage` 中：
- `metadata.thinking` 折叠区
- 保留既有图片预览/下载/加画布

**Step 3: 验证**

Run: `pnpm test tests/components/chat-message-rendering.test.tsx`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/hooks/chat/useGeneration.ts src/components/chat/ChatMessage.tsx src/lib/supabase/queries/messages.ts src/locales/zh-CN/chat.json src/locales/en-US/chat.json tests/components/chat-message-rendering.test.tsx
git commit -m "feat: render text-only image jobs and thinking summary in chat"
```

---

### Task 5: 监控与运营策略（可观测 + 扣点规则）

**Files:**
- Modify: `supabase/functions/generate-image/index.ts`
- Modify: `supabase/functions/_shared/errors/index.ts`
- Modify: `docs/api.md`

**Step 1: 实现结构化日志**

日志字段统一：
- `model`
- `providerCode`
- `outputKind` (`image|text|error`)
- `hasThoughtSummary`
- `retryCount`
- `jobId`

**Step 2: 扣点策略（建议）**

若最终 `kind=text`：
- 方案 A（推荐）：全额退款到 points ledger（最安全）  
- 方案 B：保留扣点但标记可申诉

先落地 A，确保用户体验一致。

**Step 3: API 文档更新**

在 `docs/api.md` 写明：
- 可能返回 `text-only` 结果
- 前端应始终订阅 job 并读取 `output.kind`

**Step 4: Commit**

```bash
git add supabase/functions/generate-image/index.ts supabase/functions/_shared/errors/index.ts docs/api.md
git commit -m "chore: add observability and text-only billing policy"
```

---

## 验收清单（Release Gate）

1. 输入同一提示，`gemini-3-pro-image-preview` 在 native 模式下可出现三种稳定行为：`image/text/error`。  
2. 出现 text-only 时，聊天面板显示文本，且可展开“思考过程”。  
3. 出现 image 时，图片正常上画布，历史消息可预览。  
4. job 不再因 text-only 直接 `failed`（除非策略明确要求）。  
5. 日志可区分“模型没出图”与“解析失败”。  
6. 测试覆盖 parse + job + UI 三层。

---

## 发布顺序（建议）

1. Task 1 + Task 2（契约与解析）  
2. Task 4（前端显示）  
3. Task 3（自动重试提效）  
4. Task 5（监控与扣点收口）

