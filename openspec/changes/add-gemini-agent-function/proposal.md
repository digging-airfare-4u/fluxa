## Why

当前聊天面板只有基于模型类型的隐式分流：选择图片模型时走 `generate-image`，选择文本/ops 模型时走 `generate-ops`。这种方式能工作，但不适合表达“经典生成”和“Agent 推理”这两类本质不同的交互方式。与此同时，代码库已经具备 Gemini 图像生成 provider、资产上传、积分扣费、占位符与 Realtime 回填能力，新的模式设计不应绕开这条现有主链路。

这个 change 需要解决两件事：

1. 为聊天输入区增加一个收敛后的显式模式概念，让用户能在不丢失现有 classic 流程的前提下切换到 Agent。
2. 让 Agent 的图片工具复用现有 Gemini 图片生成、provider registry、积分与存储链路，而不是再做一套平行后端。

## What Changes

- **新增聊天模式选择器 UI**：在 ChatInput 中增加显式模式切换，只提供 `classic` 和 `agent` 两种模式；默认保持 `classic`，避免回归当前主流程
- **新增 Agent 后端**：创建 `supabase/functions/agent/index.ts` Edge Function，负责可配置聊天 provider 驱动的多轮推理、function calling 和 SSE 流式响应
- **新增 Agent 结构化过程流**：Agent 不暴露原始推理全文，而是通过结构化 SSE 事件输出阶段、计划、步骤、决策、工具状态与引用来源，供前端可视化展示
- **新增 Agent 规划/执行分层**：在 `agent` 内部引入 planner / executor 双阶段架构，由规划模型决定是否需要搜索、是否需要图片参考以及执行策略
- **新增 Agent 会话持久化**：增加 `agent_sessions` 表，用于保存 Agent 专用的推理上下文历史
- **保留 classic 内的现有图片生成链路**：Gemini 图片生成继续在 `classic` 模式内通过现有 `generate-image` 主链路完成，使用当前已存在的 Gemini image provider、资产上传、积分扣费、占位符和 Realtime 回填逻辑
- **提取共享图片生成能力**：将 Agent 内部的 `generate_image` 工具建立在现有共享 provider / asset / reference-image 能力之上，并把“生成上传核心能力”和“外层计费 / job 包装”拆开，避免复制第二套 Gemini 图像生成实现或发生双重扣费
- **新增 Agent 搜索工具链**：为 Agent 增加 `web_search`、结果抓取/验证、`image_search` 与图片引入能力，并允许模型自行决定是否需要搜索
- **新增来源验证与引用展示**：搜索结果不能直接作为最终事实，必须经过页面抓取和验证后才能进入最终答案，并以 citations 的形式返回前端
- **新增外部图片缓存入库策略**：图片搜索命中的外部图片不能直接作为模型输入，必须先经过服务端下载、校验并转为受信任的临时资产或项目资产后再传给模型
- **扩展前端生成流程**：`useGeneration` 和聊天状态新增模式分发；Agent 走 SSE，Classic 保持现有 model-driven + job / realtime 行为
- **统一 Agent 最终消息持久化责任**：成功的 Agent 最终回复由后端写入 `messages`，并通过 SSE 最终事件把已持久化消息 payload 返回前端用于替换 pending message，避免重复创建消息
- **新增 Agent Brain 可配置能力**：Agent 的文本/推理运行时不再硬编码 Gemini，而是支持系统聊天模型和用户自定义 chat provider（BYOK）作为“大脑”
- **新增 Agent 专用模型可见性约束**：Agent 需要在 `ai_models` 中有独立计费 / 展示记录，但该记录不得出现在 classic 模式的 `ModelSelector` 中
- **新增 Agent 回复消息持久化**：Agent 成功回合除了写入 `agent_sessions`，还需要把最终 assistant 回复写入现有 `messages` 表，确保刷新后仍可见
- **补齐实体关联校验**：Agent 请求除了 project / conversation 校验，还需要验证 `documentId` 归属及其与 `projectId` / `conversationId` 的一致性

## Capabilities

### New Capabilities
- `chat-mode-selector`: 聊天输入区模式选择器，支持 `classic`、`agent` 两种模式，并根据模式调整发送路由和工具栏显示
- `gemini-agent`: Supabase Edge Function 驱动的可配置 Agent，支持多轮推理、函数调用、SSE 流式响应，以及 Agent 会话历史持久化
- `agent-process-visualization`: 聊天面板可视化展示 Agent 的结构化过程流，包括阶段、步骤、决策、工具状态与引用来源，但不暴露原始推理全文

### Modified Capabilities
- 现有聊天生成链路需要增加“模式”这一上层概念，但 **classic 模式下的现有 model/image/ops 行为保持不变**
- 现有 `generate-image` 能力将继续被 classic 图片生成链路和 Agent 工具共同复用，而不是被替换
- `gemini-image-generator` 相关能力不再作为独立一级模式出现，而是继续以内聚的 classic-mode 图片生成能力存在

## Impact

- **新增数据库表**：`agent_sessions`（以 `conversation_id` 为主键保存 Agent 历史）
- **扩展模型配置**：`ai_models` 需要支持“agent-only / 不进入 classic selector”的可见性标记，并为 Agent 增加专用计费模型记录
- **新增 Edge Function**：`supabase/functions/agent/index.ts`
- **扩展共享模块**：需要把现有 `generate-image` 中与 Gemini 图片生成相关的共享能力下沉到 `_shared/`，供 `generate-image` 和 `agent` 共同使用
- **前端改动范围**：
  - `src/components/chat/ChatInput.tsx`：新增模式选择器，并按模式控制工具栏
  - `src/components/chat/ChatPanel.tsx`：按模式分发 classic / agent 两条发送路径
  - `src/components/chat/ChatMessage.tsx` / Agent 相关展示组件：新增可展开的 Agent 过程面板、步骤列表、工具状态、来源引用与图片结果展示
  - `src/hooks/chat/useGeneration.ts`：新增 Agent 调用路径，同时保留现有图片 job / realtime 流程，并消费结构化 SSE 事件
  - `src/lib/store/useChatStore.ts`：新增 `chatMode`、`selectedAgentModel` 状态，并保留 classic / agent 各自的模型选择
  - `src/lib/api/generate.ts`：新增 Agent SSE 客户端调用、结构化事件解析与搜索/引用事件类型
  - `src/lib/supabase/queries/models.ts` / `src/lib/models/resolve-selectable-models.ts`：过滤 Agent 专用模型，避免其进入 classic 模式模型选择器，并把用户自定义 provider 区分为 image / chat 两类
  - `src/lib/supabase/queries/messages.ts`：扩展消息 metadata，持久化 Agent 模式、过程摘要、引用来源和搜索结果信息
- **现有链路保持有效**：
  - `generate-ops` 保持 classic 模式入口
  - `generate-image` 保持 classic 图片生成入口，并作为 Agent 图片工具的共享基础设施调用方之一
  - 当前 Gemini 图片模型、积分、占位符、资产存储与消息渲染逻辑继续使用
