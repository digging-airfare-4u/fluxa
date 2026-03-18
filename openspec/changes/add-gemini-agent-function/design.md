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
3. 让 Agent 的图片工具复用现有图片主链路，同时保持 classic 下的图片生成能力不回归
4. 把 Agent 的执行过程以结构化方式暴露给前端，而不是暴露原始推理全文
5. 让 Agent 能自行决定是否搜索，并对搜索结果做验证与引用展示

## Goals / Non-Goals

**Goals**

- 在 ChatInput 中新增显式模式选择器
- 保留当前 classic 生成行为，不回归现有 ops / image 主流程
- 新增 Agent Edge Function，支持可配置聊天 provider 推理、function calling 和 SSE
- 让 Agent 的阶段、计划、步骤、决策、工具调用与来源引用可被前端可视化展示
- 让 Agent 内部支持 planner / executor 分层，并能自行决定是否需要 web / image search
- 新增 Agent 会话历史持久化
- 保持 classic 模式下的 Gemini 图片生成继续复用现有 Gemini image provider、积分、存储、占位符与 Realtime 逻辑
- 让 Agent 的 `generate_image` 工具复用同一套共享图片生成能力

**Non-Goals**

- 不移除现有 `generate-ops` / `generate-image`
- 不在本期实现 Agent 直接生成 canvas ops
- 支持复用现有 BYOK provider 配置体系，把 `chat` 类型 provider 暴露给 Agent 作为可配置 brain
- 不在本期实现视频或多工具生态
- 不为 Gemini 图片再新增一条完全平行的上传 / 积分 / provider 实现
- 不向最终用户直接暴露模型原始 chain-of-thought

## Decisions

### D1: 模式选择器保留 classic，只新增 agent

**选择**

ChatInput 显示两个模式标签：

- `Classic`
- `Agent`

首次进入默认选中 `classic`，以保持当前用户心智和现有主流程。

**工具栏联动**

| 模式 | ModelSelector | 其他工具栏 |
|------|:---:|:---:|
| Classic | 保持现有行为 | 保持现有行为 |
| Agent | 显示仅含文本/ops 模型的 selector | 显示 Agent 需要的宽高比、分辨率和 `@Mention` 控件 |

**理由**

当前仓库的核心业务能力仍然是 classic 模式下的 ops / image 生成。`Agent` 是一种新的交互范式，值得单独成为一级模式；而图片生成仍属于 classic 下的模型驱动能力，不值得再抽成第三个一级入口。

### D2: Agent 是新函数；图片生成继续留在 classic

**选择**

- 新增 `supabase/functions/agent/index.ts`
- `agent` 只负责 Agent 推理、SSE 流和 Agent 会话
- classic 下选择图片模型时仍调用现有 `generate-image`

**不选择**

- 不新增独立的 `image-generator` 顶层模式
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

若把 classic 图片生成再拆成新的顶层模式或 SSE 新链路，就会复制一套占位符、去重、消息、存储和错误处理逻辑。

### D3: 抽取共享图片生成服务，而不是复制逻辑

**选择**

把 `generate-image` 中与 Gemini 图片生成有关的通用逻辑下沉到 `_shared/` 供两个调用方复用，并显式拆成两层：

- **核心生成层**：provider 解析、参考图抓取与大小处理、Gemini 调用、资产上传、统一错误模型
- **外层编排层**：积分扣费、job 写入 / 更新、前端契约包装

两个调用方分别为：

- `generate-image`：继续走现有 job 异步链路，并保留现有图片模型计费
- `agent`：在请求入口先扣一次 Agent 模型费用，工具执行时只复用核心生成层，不再重复扣图片模型费用

共享范围包括：

- provider 解析
- 参考图抓取与大小处理
- 资产上传
- 统一错误模型
- 不包含 `generate-image` 专属的 points + jobs 包装

**理由**

Agent 的 `generate_image` 工具和 classic 下的图片生成本质上都在“生成一张图片并落到项目资产中”，差异只在于外层协议与计费时机，而不在图片生成本身。若不把计费从共享能力里拆出来，Agent 会在“请求级扣费”和“图片工具级扣费”之间产生双扣或分叉实现。

### D4: Agent 使用 SSE；classic 保持现有 jobs + Realtime 图片链路

**选择**

- `agent` 返回 `text/event-stream`
- classic 下的图片生成继续复用现有 `generate-image` → `jobs` → `subscribeToJob` 路径

**Agent SSE 事件**

```typescript
type AgentSSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: 'generate_image' }
  | { type: 'tool_result'; imageUrl?: string; message?: string }
  | { type: 'error'; message: string }
  | {
      type: 'done';
      message: {
        id: string;
        content: string;
        metadata: {
          mode: 'agent';
          modelName: string;
          thinking?: string;
          imageUrl?: string;
          imageUrls?: string[];
        };
      };
    };
```

**理由**

当前图片链路的难点不是“如何拿到图片 URL”，而是：

- 占位符初始位置
- 用户拖拽后的最终位置
- `pendingGenerationTracker` 去重
- `saveOp` 落盘
- job 已完成时的 race condition

这些都已经在现有 `useGeneration` 里被解决，不应为了一个额外的图片一级模式重写一遍。

同时，Agent 的前端仍然需要替换本地 pending message。由于当前消息 Realtime 订阅只监听 `INSERT`，不监听 `UPDATE`，因此不能把“前端等待数据库变更再回填最终消息”当作默认契约。最稳定的做法是：后端在成功回合内先完成 `messages` 落库，再把最终消息 payload 放进 `done` 事件，由前端直接用该 payload 替换 pending message。

### D4.1: Agent 过程可视化使用结构化事件，不暴露原始推理全文

**选择**

- Agent 不直接把原始推理文本流式输出给前端
- Agent 以结构化 SSE 事件输出：
  - `phase`
  - `plan`
  - `step_start`
  - `step_done`
  - `decision`
  - `tool_start`
  - `tool_result`
  - `citation`
  - `text`
  - `done`
- 前端聊天面板把这些事件组织成可展开的过程面板 / timeline

**示例**

```typescript
type AgentSSEEvent =
  | { type: 'phase'; phase: 'understanding' | 'planning' | 'searching' | 'executing' | 'finalizing'; label: string }
  | { type: 'plan'; steps: Array<{ id: string; title: string; status: 'pending' | 'in_progress' | 'completed' }> }
  | { type: 'step_start'; stepId: string; title: string }
  | { type: 'step_done'; stepId: string; summary?: string }
  | { type: 'decision'; key: 'needs_search' | 'needs_image_search'; value: boolean; reason?: string }
  | { type: 'tool_start'; tool: string; inputSummary?: string }
  | { type: 'tool_result'; tool: string; resultSummary?: string }
  | { type: 'citation'; citations: Array<{ title: string; url: string; domain: string }> }
  | { type: 'text'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done'; message: PersistedAgentMessagePayload };
```

**理由**

用户需要看到 Agent 在做什么，但不需要也不应该看到未经筛选的原始推理全文。结构化事件既能支持前端逐步可视化，也能把输出约束在产品可控范围内。

### D4.2: Chat 面板展示 Agent 的过程 timeline 与引用来源

**选择**

- Agent assistant message 在聊天面板中显示一个可展开的“过程”区域
- 该区域至少展示：
  - 当前阶段
  - 计划步骤与状态
  - 搜索 / 工具执行状态
  - 引用来源列表
  - 生成出的图片结果（若有）
- 默认收起或半展开，避免压迫主聊天流

**理由**

如果只把结构化事件发到前端而不在聊天面板中呈现，用户依然感知不到 Agent 的过程。必须把事件映射成稳定的 UI 模型，才能真正实现“过程可视化”。

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

### D6.1: `projectId` / `documentId` / `conversationId` 必须做关联一致性校验

**选择**

- Agent 请求除了校验用户可访问 `projectId` 与 `conversationId`，还必须校验：
  - `documentId` 可被当前用户访问
  - `conversationId` 属于 `projectId`
  - `documentId` 属于 `projectId`
- 任一关联不一致时，请求在进入推理前直接失败

**理由**

`documentId` 不是无关参数。当前资产上传与后续持久化链路会把它写入资产 metadata，并可能在未来扩展到更多文档级写入行为。若只校验 project / conversation，不校验 document 归属，就会引入跨文档脏关联，后续演进时还会变成越权入口。

### D7: 模型与积分策略遵循现有 `ai_models`

**选择**

- `classic` 模式继续使用当前选中的 `selectedModel`
- Gemini 系统图片模型 `gemini-3-pro-image-preview` 继续作为 classic 模式里的普通可选图片模型存在
- `agent` 模式新增一个 `ops` 类型系统模型记录用于积分与展示，例如 `fluxa-agent`
- 该 Agent 模型记录需要带有明确的 `is_agent_only`（或等价语义）标记，使其可用于 points / display lookup，但不会被 `fetchModels` / `ModelSelector` 当成 classic 模型暴露给用户

**理由**

当前代码库的积分、模型展示和默认模型都围绕 `ai_models` 工作。Agent 若不进入这张表，就会脱离现有计费与展示体系；但若直接作为普通 `ops` 模型暴露，又会被 classic 路由错误地发送到 `generate-ops`。因此必须同时定义“存在于计费体系中”与“不可出现在 classic selector 中”这两个约束。

### D7.1: Agent 模型配置应预留 planner / executor 角色扩展

**选择**

- 本期至少需要一条 Agent 专用模型记录用于计费与展示
- 为后续 planner / executor 拆分预留可扩展字段或等价配置语义，例如：
  - `usage_scope`: `classic` | `agent` | `all`
  - `agent_role`: `planner` | `executor` | null
  - `is_visible_in_selector`
  - `supports_tool_calling`
- 若本期暂不新增这些列，也需在设计上明确 Agent 模型配置不能被限制为单一布尔开关

**理由**

你现在只做一个 Agent 模型也可以上线，但一旦要引入“规划模型”和“执行模型”，单纯的 `is_agent_only` 很快就不够用。现在预留配置语义，未来扩展成本最低。

### D7.2: Agent 采用 planner / executor 双阶段架构

**选择**

- `planner` 负责：
  - 理解用户需求
  - 生成结构化计划
  - 决定是否需要 web search / image search / image generation
  - 决定执行策略
- `executor` 负责：
  - 按计划执行
  - 调用工具
  - 汇总结果
  - 输出最终消息
- 对用户界面仍然只有一个 `agent` 模式

**理由**

“让模型自己决定要不要搜索”本质上是一个规划问题，而不是纯执行问题。把规划与执行拆开，才能既支持过程可视化，也支持更稳定的工具决策。

### D7.3: 第一阶段不引入 LangGraph，采用手写 orchestration，但保持可迁移的图节点边界

**选择**

- 第一阶段的 Agent 编排逻辑直接在 `supabase/functions/agent/index.ts` 及其邻近模块中手写实现
- 不在本期引入 `LangChain` 或 `LangGraph` 作为运行时依赖
- 但内部代码组织按可迁移的图节点边界拆分，例如：
  - `planRequest`
  - `decideSearch`
  - `runWebSearch`
  - `runImageSearch`
  - `ingestSearchImage`
  - `executeTools`
  - `finalizeResponse`
  - `persistTurn`
- 节点之间通过显式状态对象传递上下文，避免把流程耦合在一个超长函数中

**理由**

当前项目的运行时是 Supabase Edge Functions，且已有大量自定义的鉴权、积分、资产上传、SSE 和消息持久化边界。第一阶段直接引入 `LangGraph` 会增加新的依赖、运行时和调试复杂度，而这些复杂度并不是当前最主要风险。

同时，当前 Agent 设计确实已经具备典型的图编排特征，所以内部代码应按“未来可迁移到 LangGraph”的方式拆分；这样可以兼顾短期实现成本与长期演进空间。

### D8: Agent 最终回复仍然落在 `messages` 表，`agent_sessions` 只保存内部推理上下文

**选择**

- `agent_sessions` 只保存 Agent 内部历史，用于下一轮推理，不与特定 provider 绑定
- 每次成功的 Agent 回合由 **Edge Function 作为唯一写入方**，写入一条 `messages.role = 'assistant'` 记录
- 前端 Agent SSE 流程只负责维护本地 pending message，并在收到最终 `done` 事件后用其中的已持久化消息 payload 替换 pending message；前端不得再次调用 `createMessage` 创建第二条最终消息
- 该消息 metadata 至少包含：
  - `mode: 'agent'`
  - `modelName`
  - 可选 `thinking`
  - 可选图片引用（单图 URL 或生成图片列表）

**理由**

当前聊天面板的历史加载、刷新恢复和 Realtime 展示都建立在 `messages` 表之上，而不是 `agent_sessions`。如果只持久化内部会话历史，不持久化最终 assistant message，Agent 回复在页面刷新后会消失，和现有聊天体验不一致。

同时，若不明确“后端是唯一最终消息写入方”，实现阶段极易出现“后端插一条、前端再插一条”的重复消息问题。

### D9: 首次进入 Agent 时继承当前会话的可见聊天上下文

**选择**

- 若当前 `conversationId` 尚无 `agent_sessions` 记录，Agent 首轮上下文初始化时除了系统提示词，还要从当前会话 `messages` 中提取最近的用户可见聊天消息作为 bootstrap context
- bootstrap 仅包含用户与 assistant 的可见文本/图片引用，不包含内部推理细节
- 一旦 `agent_sessions` 建立，后续轮次以 `agent_sessions.history` 为主，并按保留窗口截断

**理由**

模式选择器是在同一个聊天线程里切换 `classic` / `agent`。若首次进入 Agent 时只使用“系统提示词 + 当前 prompt”，用户会在同一会话里感知到 Agent 忘记前文，违背聊天线程连续性的预期。

### D10: 参考图输入必须绑定当前项目资产或受信任存储域名

**选择**

Agent 和 classic 下的图片生成都只接受以下两类参考图：

- 当前项目中通过 `@mention` 选择的资产
- 已在系统 allowlist 内的受信任存储 URL

服务端在抓取前必须验证 URL 归属，不接受任意外部地址。

**理由**

否则会把 `referenceImageUrl` 变成新的远程抓取入口，带来 SSRF 和越权读取风险。

### D11: Agent 内置 web search / image search 工具，但搜索结果必须先验证再用于回答

**选择**

- Agent 工具集中新增：
  - `web_search(query)`
  - `fetch_search_result(url)` 或等价页面抓取工具
  - `image_search(query)`
  - `ingest_search_image(url)` 或等价图片引入工具
- planner 可以自行决定是否需要调用搜索工具
- 搜索结果标题/摘要不能直接作为最终事实写入回答，必须至少经过一次来源抓取与验证

**理由**

搜索引擎返回的是候选线索，不是已经验证的事实。若让模型直接根据搜索结果卡片作答，准确率会不可控，也无法给用户稳定的引用来源。

### D12: 外部搜索图片必须先转为受信任资产，再传给模型

**选择**

- `image_search` 返回的外部图片 URL 不能直接进入模型上下文
- 服务端需要先执行：
  - URL 与 MIME 校验
  - 大小 / 尺寸限制
  - 下载与内容验证
  - 转存为受信任临时资产或项目资产
- 后续只把转存后的受信任资产 URI / 字节内容传给模型

**理由**

这既符合当前“只接受项目资产或受信任来源”的安全边界，也避免把外部任意图片 URL 变成新的高风险输入通道。

### D13: 最终答案与消息 metadata 需要包含 citations 和搜索摘要

**选择**

- Agent 最终 assistant message metadata 除 `mode` / `modelName` / `thinking` 外，还应支持：
  - `citations`
  - `searchSummary`
  - `processSummary`
  - 可选 `searchImages`
- 前端在消息卡片中展示引用来源，并允许用户展开查看搜索过程摘要

**理由**

如果搜索和验证发生过，但最终结果里没有 citations 和摘要，用户无法判断可信度，前端也无法把“可视化过程”持续保存在历史消息中。

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

**[R5] 搜索结果可能不准确或过时**

- 风险：模型根据未验证搜索摘要直接回答
- 缓解：引入“搜索 -> 页面抓取 -> 验证 -> citation”四段式流程

**[R6] 过程可视化若直接暴露原始推理，会带来产品与安全问题**

- 风险：输出不可控、内容冗长、暴露不必要中间推理
- 缓解：只暴露结构化过程摘要事件，不暴露原始 CoT

## Resolved Questions

1. **是否保留当前 classic 行为**：保留，而且作为默认模式
2. **是否需要单独的图像生成器一级模式**：不需要，图片生成继续留在 classic
3. **Agent 的图片工具是否单独实现**：不单独实现，复用共享图片生成服务
4. **模式偏好如何持久化**：前端使用 localStorage 保存模式；classic 下的 `selectedModel` 单独保留
5. **思考过程是否直接展示原始推理**：不直接展示，改为结构化过程可视化
6. **是否让模型自行决定要不要搜索**：是，由 planner 决定
7. **第一阶段是否直接接入 LangGraph**：否，先手写 orchestration，并保留可迁移的节点边界
