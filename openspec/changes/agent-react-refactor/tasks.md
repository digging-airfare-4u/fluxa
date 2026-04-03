## 1. Phase A — Provider 层 Tool Use 扩展

- [ ] 1.1 扩展 `chat-types.ts`：新增 `ToolSchema`、`ToolCallResult` 类型，`ChatCompletionOptions` 新增可选 `tools` 和 `toolChoice` 字段，`ChatCompletionResult.content` 改为 `string | null`，新增可选 `toolCalls` 字段
- [ ] 1.2 扩展 `OpenAICompatibleClient.chatCompletion()`：当 `options.tools` 存在时，将 `ToolSchema[]` 转为 OpenAI format `{ type: "function", function: { name, description, parameters } }[]` 写入 request body；从 response `choices[0].message.tool_calls` 提取 `ToolCallResult[]`
- [ ] 1.3 扩展 `AnthropicCompatibleClient.chatCompletion()`：当 `options.tools` 存在时，将 `ToolSchema[]` 转为 Anthropic format `{ name, description, input_schema }[]` 写入 request body；从 response content blocks 中提取 `type: "tool_use"` 块为 `ToolCallResult[]`
- [ ] 1.4 扩展 `VolcengineChatProvider.chatCompletion()`：透传 `tools`/`toolChoice` 给底层 `OpenAICompatibleClient`
- [ ] 1.5 扩展 `AnthropicChatAdapter.chatCompletion()`：透传 `tools` 给 Anthropic API，处理 tool_use content blocks
- [ ] 1.6 扩展 `UserConfiguredChatProvider.chatCompletion()`：透传 `tools`/`toolChoice` 给底层 client（OpenAI 或 Anthropic compatible）
- [ ] 1.7 验证：写一个手动测试脚本，分别对 Volcengine、Anthropic、OpenAI provider 发送带 tools 的 chat completion 请求，确认 tool_calls 正确返回

## 2. Phase B — 工具注册表 + ReAct 循环

- [ ] 2.1 新建 `supabase/functions/_shared/utils/agent-tools.ts`：定义 `ToolDefinition`、`ToolContext`、`ToolResult` 接口，实现 `AgentToolRegistry` class（Map 封装，提供 `register`、`execute`、`getSchemas` 方法）
- [ ] 2.2 在 `agent-tools.ts` 中注册 `web_search` 工具：name/description/inputSchema 定义 + handler（从现有 `agent/index.ts` 的 web_search 分支提取）
- [ ] 2.3 在 `agent-tools.ts` 中注册 `fetch_url` 工具：同上，从现有 fetch_url 分支提取
- [ ] 2.4 在 `agent-tools.ts` 中注册 `image_search` 工具：同上，从现有 image_search 分支提取
- [ ] 2.5 在 `agent-tools.ts` 中注册 `generate_image` 工具：同上，从现有 generate_image 分支提取，handler 需要 image provider 解析和 asset upload 逻辑
- [ ] 2.6 新建 `supabase/functions/_shared/utils/react-loop.ts`：实现 `runReActLoop` 函数（接收 messages、provider、toolRegistry、maxIterations、onEvent），实现 while 循环：调用 provider.chatCompletion(messages, { tools }) → 判断 toolCalls → 执行工具 → 喂回结果 → 继续或返回
- [ ] 2.7 在 `react-loop.ts` 中处理 unknown tool：如果 LLM 返回的 tool name 不在注册表中，构造 error tool result 喂回 LLM（不崩溃）
- [ ] 2.8 在 `react-loop.ts` 中实现 BYOK JSON fallback 路径：当 provider 不支持 tools（chatCompletion 抛出带 tools 参数的 4xx 错误）时，切换到 JSON prompt 模式 — 将工具 schema 嵌入 system message，用 `parseJsonPayload` 解析 LLM 文本输出
- [ ] 2.9 扩展 `AgentHistoryEntry` 类型：新增可选 `tool_calls` 和 `tool_call_id` 字段
- [ ] 2.10 更新 `loadAgentHistory`：旧格式的 tool 条目（无 `tool_call_id`）转换为 assistant 文本 `"[Tool result: {name}] {content}"`
- [ ] 2.11 增强 `AGENT_SYSTEM_CONTEXT`：扩展 system prompt 增加 Fluxa 产品上下文、工具使用指引、输出格式约束
- [ ] 2.12 重写 `agent/index.ts` 主流程：移除 `createPlanner`/`createExecutor` 调用，改为初始化 `AgentToolRegistry` → 调用 `runReActLoop` → 保存 history → 持久化 message → 发送 done 事件
- [ ] 2.13 SSE 事件过渡兼容：在 `runReActLoop` 的 `onEvent` 回调中，除了发送新事件外，额外发送旧的 `phase` 事件（`{ type: 'phase', phase: 'executing', label: 'Executing' }`）以兼容当前前端
- [ ] 2.14 部署 agent Edge Function 并手动测试：纯文本对话、web_search 对话、generate_image 对话、多轮对话、BYOK provider 对话

## 3. Phase C — 前端适配

- [ ] 3.1 更新 `src/lib/api/generate.ts` 的 `AgentSSEEvent` 类型定义：移除 `plan`/`decision`/`step_start`/`step_done`/`phase` 事件类型，确认 `tool_start`/`tool_result`/`text`/`done`/`error` 保留
- [ ] 3.2 更新 `src/hooks/chat/agent-process.ts`：移除对 `plan`/`decision`/`step_*`/`phase` 事件的 reducer 处理，简化 pending state（不再需要 steps/plan 状态）
- [ ] 3.3 更新 `src/hooks/chat/useGeneration.ts` 的 `handleAgentEvent`：移除对已删除事件的处理分支
- [ ] 3.4 更新 ChatPanel 中 agent pending 消息的 UI：不再显示 planning/step 动画，改为只显示 tool 执行进度（tool_start → spinner，tool_result → 完成）
- [ ] 3.5 验证前端：确认纯文本、tool call、多轮对话场景下 UI 正确更新，无 console 报错

## 4. Phase D — 清理

- [ ] 4.1 从 `agent/index.ts` 移除 Phase B 的旧事件兼容代码（不再发送 `phase` 事件）
- [ ] 4.2 删除 `supabase/functions/_shared/utils/agent-orchestrator.ts` 中的废弃导出：`runAgentLoop`、`AgentPlannerResult`、`AgentPlanStep`、`RunAgentLoopArgs`、`RunAgentLoopResult`
- [ ] 4.3 从 `agent/index.ts` 删除 `createPlanner`、`createExecutor` 函数（如果 Phase B 未完全移除）
- [ ] 4.4 评估 `chat-provider-json.ts` 是否仍被使用：如果仅 BYOK fallback 使用 `parseJsonPayload`，将其移入 `react-loop.ts`；如果完全不用则删除整个文件
- [ ] 4.5 最终部署 agent Edge Function + 前端，确认全流程正常
