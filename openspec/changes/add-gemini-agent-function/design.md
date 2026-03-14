## Context

当前 Fluxa 聊天系统通过 `ModelSelector` 下拉菜单选择模型，模型类型隐式决定走哪条生成路径。前端 `useGeneration` hook 已经具备两条稳定路径：

- `startImageGeneration` → `generate-image` → `jobs` + Realtime → 占位符替换 / addImage op 落盘
- `startOpsGeneration` → `generate-ops` → 直接返回 plan + ops

代码库还已经具备下列 Gemini 相关基础设施：

- `generate-image` 通过 provider registry 调用 Gemini image provider
- `GeminiProvider` 已支持 native / OpenAI-compatible 两种模式
- 参考图抓取、资产上传、积分扣费、消息渲染都已有现成实现

因此，本次 change 的重点不是“新起一套 Gemini 图片后端”，而是：

1. 增加显式聊天模式
2. 新增 Agent 推理能力
3. 让 Agent 的图片工具与专用图像生成器模式都复用现有图片主链路

## Goals / Non-Goals

**Goals**

- 在 ChatInput 中新增显式模式选择器
- 保留当前 classic 生成行为，不回归现有 ops / image 主流程
- 新增 Agent Edge Function，支持 Gemini 推理、function calling 和 SSE
- 新增 Agent 会话历史持久化
- 让 image-generator 模式复用现有 Gemini image provider、积分、存储、占位符与 Realtime 逻辑
- 让 Agent 的 `generate_image` 工具复用同一套共享图片生成能力

**Non-Goals**

- 不移除现有 `generate-ops` / `generate-image`
- 不在本期实现 Agent 直接生成 canvas ops
- 不在本期引入 BYOK Agent provider
- 不在本期实现视频或多工具生态
- 不为 Gemini 图片再新增一条完全平行的上传 / 积分 / provider 实现

## Decisions

### D1: 模式选择器保留 classic，新增 agent / image-generator

**选择**

ChatInput 显示三个模式标签：

- `Classic`
- `Agent`
- `图像生成器`

首次进入默认选中 `classic`，以保持当前用户心智和现有主流程。

**工具栏联动**

| 模式 | ModelSelector | AspectRatioSelector | ResolutionSelector | @Mention |
|------|:---:|:---:|:---:|:---:|
| Classic | 保持现有行为 | 保持现有行为 | 保持现有行为 | 保持现有行为 |
| Agent | 隐藏 | 显示 | 显示 | 显示 |
| 图像生成器 | 隐藏 | 显示 | 显示 | 显示 |

**理由**

当前仓库的核心业务能力仍然是 classic 模式下的 ops / image 生成。若直接只保留 Agent / 图像生成器两种模式，会把现有主入口变成兼容层，而不是主链路。

### D2: Agent 是新函数，图像生成器不是新后端

**选择**

- 新增 `supabase/functions/agent/index.ts`
- `agent` 只负责 Agent 推理、SSE 流和 Agent 会话
- `image-generator` 模式前端仍调用现有 `generate-image`

**不选择**

- 不让 `image-generator` 模式走 `agent` 函数
- 不新增 `gemini-image` Edge Function

**理由**

当前 `generate-image` 已经绑定了：

- provider registry
- Gemini provider
- 参考图抓取
- `jobs` 表
- 资产上传
- 占位符 + Realtime 回填
- 积分扣费

若图像生成器模式改走 SSE 新链路，就会复制一套占位符、去重、消息、存储和错误处理逻辑。

### D3: 抽取共享图片生成服务，而不是复制逻辑

**选择**

把 `generate-image` 中与 Gemini 图片生成有关的通用逻辑下沉到 `_shared/` 供两个调用方复用：

- `generate-image`：继续走现有 job 异步链路
- `agent`：直接在工具调用时复用共享服务

共享范围包括：

- provider 解析
- 参考图抓取与大小处理
- 资产上传
- 统一错误模型

**理由**

Agent 的 `generate_image` 工具和 image-generator 模式本质上都在“生成一张图片并落到项目资产中”，差异只在于外层协议，而不在图片生成本身。

### D4: Agent 使用 SSE；图像生成器继续使用 jobs + Realtime

**选择**

- `agent` 返回 `text/event-stream`
- `image-generator` 模式继续复用现有 `generate-image` → `jobs` → `subscribeToJob` 路径

**Agent SSE 事件**

```typescript
type AgentSSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: 'generate_image' }
  | { type: 'tool_result'; imageUrl?: string; message?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };
```

**理由**

当前图片链路的难点不是“如何拿到图片 URL”，而是：

- 占位符初始位置
- 用户拖拽后的最终位置
- `pendingGenerationTracker` 去重
- `saveOp` 落盘
- job 已完成时的 race condition

这些都已经在现有 `useGeneration` 里被解决，不应为了 image-generator 模式重写一遍。

### D5: Agent 会话表以 `conversation_id` 为主键，并由服务端独占访问

**选择**

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  history JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

并且：

- 客户端不直接读写该表
- Edge Function 使用 service role 访问
- 表开启 RLS，但不开放匿名或普通客户端策略

**理由**

表中保存的是 Agent 专用上下文，不是用户直接消费的数据结构。保留在服务端边界内更安全，也更接近当前 Edge Function 的职责划分。

### D6: 契约命名统一为当前代码风格

**选择**

Agent 请求体统一使用 camelCase，并与现有 API 参数保持一致：

```typescript
interface AgentRequest {
  projectId: string;
  documentId: string;
  conversationId: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  referenceImageUrl?: string;
}
```

**不选择**

- `session_id`
- `message`
- `aspect_ratio`
- `reference_image_url`

**理由**

当前前后端已经统一使用 `conversationId`、`prompt`、`aspectRatio`、`imageUrl` 一套命名。再引入第二套命名只会提高接线成本和出错率。

### D7: 模型与积分策略遵循现有 `ai_models`

**选择**

- `classic` 模式继续使用当前选中的 `selectedModel`
- `image-generator` 模式初期固定使用当前仓库已存在的 Gemini 系统图片模型 `gemini-3-pro-image-preview`
- `agent` 模式新增一个 `ops` 类型系统模型记录用于积分与展示，例如 `gemini-2.5-flash-agent`

**理由**

当前代码库的积分、模型展示和默认模型都围绕 `ai_models` 工作。Agent 若不进入这张表，就会脱离现有计费与展示体系。

### D8: 参考图输入必须绑定当前项目资产或受信任存储域名

**选择**

Agent 和 image-generator 模式都只接受以下两类参考图：

- 当前项目中通过 `@mention` 选择的资产
- 已在系统 allowlist 内的受信任存储 URL

服务端在抓取前必须验证 URL 归属，不接受任意外部地址。

**理由**

否则会把 `referenceImageUrl` 变成新的远程抓取入口，带来 SSRF 和越权读取风险。

## Risks / Trade-offs

**[R1] Agent 新增了第二种响应协议**

- 风险：聊天面板同时维护 SSE 和 jobs 两种流
- 缓解：限定只有 Agent 使用 SSE；图片模式继续复用原逻辑

**[R2] Agent 工具调用若不复用共享服务，会造成图片能力分叉**

- 风险：同样是 Gemini 生成图，行为、积分、上传结果不一致
- 缓解：先抽共享模块，再接 Agent

**[R3] Agent 会话历史可能膨胀**

- 风险：长对话导致 JSONB 过大
- 缓解：限制保留最近 20 轮，并保留系统上下文

**[R4] 参考图抓取存在安全边界**

- 风险：任意 URL 抓取会产生 SSRF / 越权
- 缓解：只允许项目资产或受信任域名

## Resolved Questions

1. **是否保留当前 classic 行为**：保留，而且作为默认模式
2. **图像生成器是否走 Agent SSE**：不走，继续使用现有 `generate-image`
3. **Agent 的图片工具是否单独实现**：不单独实现，复用共享图片生成服务
4. **模式偏好如何持久化**：前端使用 localStorage 保存模式；classic 下的 `selectedModel` 单独保留
