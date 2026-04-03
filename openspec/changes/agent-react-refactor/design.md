## Context

Fluxa Agent 是一个运行在 Supabase Edge Function 上的 AI 助手，支持文本对话、网页搜索、图片搜索和图片生成。当前架构使用 Planner + Executor 双 LLM 调用，通过 prompt engineering 让 LLM 返回 JSON 模拟 tool use。

核心文件现状：
- `supabase/functions/agent/index.ts` — 700 行主入口，包含 planner/executor 创建、tool 执行 if/else 链、SSE 流
- `supabase/functions/_shared/utils/agent-orchestrator.ts` — `runAgentLoop`、history 管理、planner/executor 类型定义
- `supabase/functions/_shared/utils/chat-provider-json.ts` — JSON 解析 + retry 逻辑
- `supabase/functions/_shared/providers/openai-client.ts` — OpenAI-compatible HTTP 客户端
- `supabase/functions/_shared/providers/anthropic-compatible-client.ts` — Anthropic-compatible HTTP 客户端
- `supabase/functions/_shared/providers/chat-types.ts` — ChatMessage / ChatCompletionResult 类型

Provider 体系：系统内置（Volcengine、OpenAI、Anthropic）+ BYOK（用户自带 key，通过 `user_provider_configs` 表配置，支持 `openai-compatible` 和 `anthropic-compatible` 两种 provider type）。

## Goals / Non-Goals

**Goals:**
- 将 planner + executor 双调用合并为单循环 ReAct 模式，减少延迟
- 对系统内置 provider 使用原生 tool use API，提升 tool calling 可靠性
- 对 BYOK provider 保留 JSON prompt fallback，确保向后兼容
- 引入工具注册表，解耦 tool 定义和核心循环
- 保持前端 SSE 事件协议兼容（渐进式迁移）

**Non-Goals:**
- 流式 token 输出（`text_delta` 事件预留接口但本期不实现 streaming chat completion）
- 后置计费 / 按实际用量计费（保持先扣积分的现有行为）
- 并行 tool calling（LLM 返回多个 tool_calls 时串行执行，不做并行优化）
- 前端大幅重构（仅适配新的 SSE 事件集，不改 ChatPanel 架构）

## Decisions

### D1: ReAct 循环架构

**选择：** 单函数 `runReActLoop`，接收 messages + tools + provider，内部 while 循环。

```
function runReActLoop({ messages, tools, provider, maxIterations, onEvent }):
  while (iterations < maxIterations):
    response = provider.chatCompletion(messages, { tools })

    if response.toolCalls is empty:
      // LLM 选择直接回复
      onEvent({ type: 'text', content: response.content })
      return { messages, finalText: response.content }

    for each toolCall in response.toolCalls:
      onEvent({ type: 'tool_start', tool: toolCall.name, ... })
      result = toolRegistry.execute(toolCall.name, toolCall.arguments)
      onEvent({ type: 'tool_result', tool: toolCall.name, ... })
      messages.append(toolResultMessage(toolCall.id, result))

    iterations++

  return { messages, finalText: "迭代上限" }
```

**替代方案：** 保留 planner 做路由（只决定是否需要 tool），executor 做实际执行。
**否决理由：** planner 的输出无法强制约束 executor 行为，增加一次 LLM 调用但不增加可靠性。ReAct 让同一个 LLM 上下文完成规划和执行，信息不丢失。

### D2: 工具注册表设计

**选择：** 简单的 `Map<string, ToolDefinition>` 注册表，在 edge function 入口初始化。

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  userId: string;
  projectId: string;
  documentId: string;
  serviceClient: SupabaseClient;
  registry: ProviderRegistry;
  // ... 其他工具执行需要的依赖
}

interface ToolResult {
  content: string;          // 文本描述，喂回 LLM
  imageUrl?: string;        // 图片 URL（如果有）
  assetId?: string;         // 资产 ID（如果有）
  citations?: AgentCitation[];
}
```

**替代方案：** 使用 class 继承的 Tool 抽象基类。
**否决理由：** 过度设计。工具只有 4 个（web_search、fetch_url、image_search、generate_image），简单的函数 + interface 足够。

### D3: Provider tool use 适配策略

**选择：** 在 `ChatCompletionOptions` 中新增可选 `tools` 字段。每个 provider 实现自行决定如何将工具定义翻译成 API 格式。`ChatCompletionResult` 新增可选 `toolCalls` 字段。

```typescript
// chat-types.ts 扩展
interface ChatCompletionOptions {
  // ... 现有字段
  tools?: ToolSchema[];           // 新增
  toolChoice?: 'auto' | 'none';  // 新增
}

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ChatCompletionResult {
  content: string | null;         // 改为可 null（tool call 时可能无文本）
  toolCalls?: ToolCallResult[];   // 新增
  // ... 现有字段
}

interface ToolCallResult {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
```

**OpenAI-compatible 路径：** `OpenAICompatibleClient.chatCompletion()` 将 `ToolSchema[]` 转为 `{ type: "function", function: { name, description, parameters } }[]`，从 `choices[0].message.tool_calls` 提取结果。

**Anthropic-compatible 路径：** `AnthropicCompatibleClient.chatCompletion()` 将 `ToolSchema[]` 转为 `{ name, description, input_schema }[]`，从 response `content` 数组中的 `tool_use` 块提取结果。

**替代方案：** 在 ReAct 循环层做格式翻译，provider 层不感知 tools。
**否决理由：** 违反关注点分离。不同 provider 的 tool use 格式差异大（OpenAI 用 `tool_calls`，Anthropic 用 `tool_use` content blocks），应该在 provider 层封装。

### D4: BYOK fallback 策略

**选择：** 首次尝试带 `tools` 的请求。如果 provider 返回 4xx 错误（表明不支持 tools 参数），标记该 provider 为 `fallbackMode`，后续请求自动切换为 JSON prompt 模式。标记在内存中保持（Edge Function 冷启动后重置）。

**JSON prompt fallback 模式：** 将工具定义嵌入 system prompt，要求 LLM 返回 JSON。使用现有的 `parseJsonPayload` 解析。如果 JSON 不匹配任何工具 schema，视为纯文本回复。

**替代方案 A：** 让用户在 provider config 中手动标记是否支持 tool use。
**否决理由：** 增加用户配置负担，用户可能不知道自己的 provider 是否支持。

**替代方案 B：** 始终用 JSON prompt 模式处理 BYOK。
**否决理由：** 许多 BYOK 用户使用 OpenAI-compatible 的主流 provider（如 DeepSeek、通义千问），它们完整支持 tool use，没必要降级。

### D5: History 格式演进

**选择：** 新 history 格式在 assistant 条目中增加可选 `tool_calls` 字段，新增 `tool` role 条目包含 `tool_call_id`。加载旧 history 时，无 `tool_calls` 的 assistant 条目和无 `tool_call_id` 的 tool 条目正常视为纯文本。

```typescript
interface AgentHistoryEntry {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;  // 新增，仅 assistant
  tool_call_id?: string;  // 新增，仅 tool role
}
```

**兼容性保证：** `loadAgentHistory` 的 normalization filter 已经只检查 `role` 和 `content` 是否为 string，新字段为可选，旧数据自动兼容。

### D6: SSE 事件精简

**选择：** 移除 `plan`、`decision`、`phase`、`step_start`、`step_done` 事件。保留 `tool_start`、`tool_result`、`text`、`done`、`error`。新增 `text_delta`（预留，本期 `text` 仍为完整内容一次发送）。

前端需要移除对 `plan`/`decision`/`step_*` 事件的处理逻辑（目前用于显示 planning/executing 动画），改为只根据 `tool_start`/`tool_result` 显示工具执行进度。

### D7: System Prompt 增强

**选择：** 在现有 `AGENT_SYSTEM_CONTEXT` 基础上扩展，增加：
- Fluxa 产品上下文（设计工具，用户在创建视觉项目）
- 工具使用指引（何时用 web_search vs fetch_url，何时生成图片）
- 输出格式约束（不要在文本中嵌入 raw URL，图片由 UI 单独展示）

但不在本期引入动态项目上下文（如当前文档内容），保持 system prompt 为静态常量。

## Risks / Trade-offs

**[R1] BYOK 自动检测失败** — 某些 provider 可能静默忽略 `tools` 参数而不报错，导致 LLM 不知道有工具可用。
→ **缓解：** 如果带 tools 的请求返回了纯文本且内容看起来像 JSON tool call 格式，触发 fallback 重试。

**[R2] Anthropic tool use 格式差异** — Anthropic 的 tool_result 需要作为 user message 的 content block 发送，和 OpenAI 的独立 tool message 不同，增加了 provider 层复杂度。
→ **缓解：** 在 `AnthropicCompatibleClient` 内部处理转换，ReAct 循环只看统一的 `ToolCallResult` 接口。

**[R3] 旧 session 历史兼容** — 旧格式的 tool role 条目没有 `tool_call_id`，新 LLM 调用可能对此感到困惑。
→ **缓解：** 加载旧 history 时，将无 `tool_call_id` 的 tool 条目转换为普通 assistant 文本（"[Tool result: ...]"），避免格式混淆。

**[R4] 前端 breaking change** — 移除 plan/decision 事件会导致前端显示 planning 动画的代码报错。
→ **缓解：** 前端先做防御性处理（忽略未知事件），后端分两步部署：第一步保留旧事件 + 新增新事件，第二步移除旧事件。

**[R5] 成本增加** — tool definitions 作为 prompt tokens 在每次请求中发送，4 个工具大约增加 300-500 tokens。
→ **接受：** 相比减少一次完整 LLM 调用（planner），净成本降低。

## Migration Plan

1. **Phase A：Provider 层扩展**（无 breaking change）
   - 扩展 `ChatCompletionOptions`/`ChatCompletionResult` 类型
   - 在 `OpenAICompatibleClient` 和 `AnthropicCompatibleClient` 中实现 tool use 支持
   - 新增 `ToolSchema`/`ToolCallResult` 类型
   - 现有 agent 代码不变，可独立部署验证

2. **Phase B：工具注册表 + ReAct 循环**（backend breaking change）
   - 新增 `agent-tools.ts`（工具注册表，4 个工具定义）
   - 新增 `runReActLoop` 替换 `runAgentLoop`
   - 重写 `agent/index.ts` 使用 ReAct 循环
   - SSE 事件暂时新旧并发（`text` + `tool_start`/`tool_result` + 保留 `phase` 兼容）
   - 部署后端，前端继续使用旧事件处理

3. **Phase C：前端适配**（frontend change）
   - 移除 `plan`/`decision`/`step_*` 事件处理
   - 简化 `agent-process.ts` 的 pending state 管理
   - 部署前端

4. **Phase D：清理**
   - 后端移除旧事件兼容代码
   - 删除 `AgentPlannerResult`、`createPlanner`、`createExecutor`、`callChatProviderJson` 等废弃代码

## Open Questions

- **Q1：** BYOK fallback 检测是否需要持久化（写入 `user_provider_configs` 表）还是每次 cold start 重新检测？持久化更快但增加写入开销。
- **Q2：** 是否需要在 ReAct 循环中实现 tool call 的超时机制（例如 web_search 超过 10s 自动取消）？当前没有单个工具的超时控制。
- **Q3：** `text_delta` 事件何时实现？如果近期要做流式输出，应在 Phase B 时就让 provider 支持 streaming chat completion。
