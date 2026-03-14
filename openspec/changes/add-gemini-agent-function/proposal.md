## Why

当前聊天面板只有基于模型类型的隐式分流：选择图片模型时走 `generate-image`，选择文本/ops 模型时走 `generate-ops`。这种方式能工作，但不适合表达“经典生成”和“Agent 推理”这两类本质不同的交互方式。与此同时，代码库已经具备 Gemini 图像生成 provider、资产上传、积分扣费、占位符与 Realtime 回填能力，新的模式设计不应绕开这条现有主链路。

这个 change 需要解决两件事：

1. 为聊天输入区增加显式模式概念，让用户能在不丢失现有 classic 流程的前提下切换到 Agent。
2. 将 Gemini 图像生成暴露为一个明确的“图像生成器”模式，但复用现有 `generate-image`、provider registry、积分与存储链路，而不是再做一套平行后端。

## What Changes

- **新增聊天模式选择器 UI**：在 ChatInput 中增加显式模式切换，提供 `classic`、`agent`、`image-generator` 三种模式；默认保持 `classic`，避免回归当前主流程
- **新增 Agent 后端**：创建 `supabase/functions/agent/index.ts` Edge Function，负责 Gemini 推理、多轮 function calling 和 SSE 流式响应
- **新增 Agent 会话持久化**：增加 `agent_sessions` 表，用于保存 Agent 专用的推理上下文历史
- **复用现有 Gemini 图片基础设施**：图像生成器模式继续走现有 `generate-image` 主链路，使用当前已存在的 Gemini image provider、资产上传、积分扣费、占位符和 Realtime 回填逻辑
- **提取共享图片生成能力**：将 Agent 内部的 `generate_image` 工具建立在现有共享 provider / asset / reference-image 能力之上，避免复制第二套 Gemini 图像生成实现
- **扩展前端生成流程**：`useGeneration` 和聊天状态新增模式分发；Agent 走 SSE，Classic / Image Generator 保持现有 job + realtime 行为
- **复用现有 Gemini Secret**：Agent 与 Gemini native image provider 共用已有的 `GEMINI_API_KEY`；若部署环境尚未配置，则需要补齐

## Capabilities

### New Capabilities
- `chat-mode-selector`: 聊天输入区模式选择器，支持 `classic`、`agent`、`image-generator` 三种模式，并根据模式调整发送路由和工具栏显示
- `gemini-agent`: Supabase Edge Function 驱动的 Gemini Agent，支持多轮推理、函数调用、SSE 流式响应，以及 Agent 会话历史持久化
- `gemini-image-generator`: 基于现有 Gemini image provider 暴露出来的专用图片生成模式，支持文生图、参考图编辑、宽高比与分辨率配置

### Modified Capabilities
- 现有聊天生成链路需要增加“模式”这一上层概念，但 **classic 模式下的现有 model/image/ops 行为保持不变**
- 现有 `generate-image` 能力将被 image-generator 模式和 Agent 工具共同复用，而不是被替换

## Impact

- **新增数据库表**：`agent_sessions`（以 `conversation_id` 为主键保存 Agent 历史）
- **新增 Edge Function**：`supabase/functions/agent/index.ts`
- **扩展共享模块**：需要把现有 `generate-image` 中与 Gemini 图片生成相关的共享能力下沉到 `_shared/`，供 `generate-image` 和 `agent` 共同使用
- **前端改动范围**：
  - `src/components/chat/ChatInput.tsx`：新增模式选择器，并按模式控制工具栏
  - `src/components/chat/ChatPanel.tsx`：按模式分发 classic / agent / image-generator 三条发送路径
  - `src/hooks/chat/useGeneration.ts`：新增 Agent 调用路径，同时保留现有图片 job / realtime 流程
  - `src/lib/store/useChatStore.ts`：新增 `chatMode` 状态以及 classic 模式下模型选择的保留逻辑
  - `src/lib/api/generate.ts`：新增 Agent SSE 客户端调用
- **现有链路保持有效**：
  - `generate-ops` 保持 classic 模式入口
  - `generate-image` 保持 classic 图片生成入口，并作为 image-generator 模式的复用后端
  - 当前 Gemini 图片模型、积分、占位符、资产存储与消息渲染逻辑继续使用
