## Why

当前 Agent 采用 Planner + Executor 双 LLM 调用架构，通过 prompt engineering 让 LLM 返回原始 JSON 来模拟 tool use。这导致三个已验证的问题：

1. **可靠性差** — LLM 返回的 JSON 不符合预期 schema 时，`runAgentLoop` 将其错误地当作 tool call 处理，并 fall through 到 `generate_image` 分支（已出现线上 bug：用户纯文本对话触发了 "Invalid request: Prompt is required"）。
2. **延迟高** — 每条用户消息都需要两次 LLM 调用（planner + executor），简单问候也不例外。
3. **Planner 产出未被强制执行** — Planner 输出的 `executionMode`、`needsSearch` 等字段仅供参考，Executor 可以完全忽略，使 planner 调用变成纯粹的浪费。

## What Changes

- **去掉 Planner/Executor 双调用**，合并为单循环 ReAct 模式：LLM 每轮要么直接回复文本，要么发起 tool call，tool 结果喂回后继续，直到 LLM 结束回复。**BREAKING**：`AgentPlannerResult` 类型和 planner 相关的 SSE 事件（`plan`、`decision`）将被移除。
- **对系统内置 provider 启用原生 tool use API**（OpenAI format `tools` 字段 / Anthropic format `tools` 字段），由 provider 保证 tool call 的 JSON schema 合规性。
- **对 BYOK provider 保留 JSON prompt fallback**，当 provider 不支持 tool use 时退化为现有的 prompt-based JSON 模式，确保兼容性。
- **工具注册表模式** — 工具从硬编码 if/else 链改为自描述注册（name、description、inputSchema、handler），新增工具只需注册，不改核心循环。
- **SSE 事件协议更新** — 移除 `plan`/`decision` 事件，保留 `tool_start`/`tool_result`/`text`/`done`/`error`，新增 `text_delta` 事件为未来流式输出预留。**BREAKING**：前端需适配新的事件协议。

## Capabilities

### New Capabilities
- `agent-core`: Agent 核心循环（ReAct loop）、工具注册表、SSE 事件协议、历史管理。
- `agent-tool-use`: 原生 tool use 适配层 — OpenAI format 和 Anthropic format 的 tool calling 支持，以及 BYOK JSON prompt fallback。

### Modified Capabilities
（无已有 spec 被修改 — agent 此前没有 spec）

## Impact

- **Edge Function**: `supabase/functions/agent/index.ts` — 主入口重写，去掉 createPlanner/createExecutor，改为 ReAct 循环。
- **Agent Orchestrator**: `supabase/functions/_shared/utils/agent-orchestrator.ts` — 移除 `runAgentLoop`、`AgentPlannerResult` 等类型，新增 `runReActLoop`。
- **Chat Provider**: `supabase/functions/_shared/providers/openai-client.ts`、`anthropic-compatible-client.ts` — 新增 `tools` 参数支持，返回值新增 `tool_calls` 字段。
- **Chat Types**: `supabase/functions/_shared/providers/chat-types.ts` — 扩展 `ChatCompletionResult` 以包含 tool call 结构。
- **前端 SSE 处理**: `src/lib/api/generate.ts`、`src/hooks/chat/useGeneration.ts`、`src/hooks/chat/agent-process.ts` — 适配新的 SSE 事件协议（移除 plan/decision 事件处理，新增 text_delta）。
- **Agent Sessions**: `agent_sessions.history` 的 JSON 结构变更 — 新增 `tool_calls` 和 `tool_result` 类型条目。需要兼容旧格式的 history 加载。
