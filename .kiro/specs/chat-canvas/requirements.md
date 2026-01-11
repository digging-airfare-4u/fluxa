# Requirements Document

## Introduction

ChatCanvas 是一个类似 Lovart 的设计生成网站，用户可以通过聊天描述需求，AI 生成可编辑的设计画布。后端完全使用 Supabase（Auth / Postgres / Storage / Edge Functions / Realtime）。

核心理念是 **ops（操作日志）驱动画布**：
- AI 不直接"画死图"，而是输出结构化的 ops 指令
- 前端 OpsExecutor 将 ops 转换为 Fabric.js 对象操作
- 所有操作可回放、可撤销、未来可支持多人协作

### 技术栈约束（固定）
- 前端：Next.js（App Router）+ TypeScript
- UI：Tailwind + shadcn/ui
- 状态管理：Zustand
- Canvas：Fabric.js
- 后端：Supabase（Auth / Postgres / Storage / Edge Functions / Realtime）
- Node：>= 18
- 包管理：pnpm

### MVP 成功标准
用户可在一个网页完成：
1. 用 Chat 描述需求
2. AI 生成可编辑设计（至少：背景 + 标题 + 副标题 + 一张主视觉图层）
3. 在 Canvas 里拖拽/编辑文字/替换图片
4. 一键导出 PNG（2x/4x），并保存为资产

### 用户画像 & 体验北极星
- **Persona A：独立设计师/小店主** — 需要快速生成营销海报，关注操作少、导出快、可复用模板。
- **Persona B：产品/运营** — 需要多版本快速迭代，关注一致性与资产组织。
- **体验北极星指标**
  - 生成成功率 ≥ 95%（含 schema 校验通过率）
  - 首次生成延迟 P95 ≤ 6s；导出完成 P95 ≤ 4s
  - 导出转化率 ≥ 60%；资产留存率（7天内再次访问）≥ 50%
  - 生成内容安全命中率 ≤ 1%，违规回退有明确提示

## Glossary

- **Canvas**: 基于 Fabric.js 的可编辑画布组件，默认尺寸 1080x1350 像素
- **Ops**: 操作日志，AI 输出的画布操作指令，必须符合 JSON Schema
- **Op Types**: 
  - `createFrame` - 创建画布框架
  - `setBackground` - 设置背景颜色或渐变
  - `addText` - 添加文本图层
  - `addImage` - 添加图片图层
  - `updateLayer` - 更新图层属性
  - `removeLayer` - 删除图层
  - `align` - 对齐图层（MVP+可选）
- **OpsExecutor**: 将 ops JSON 转换为 Fabric 对象操作的执行器
- **Project**: 用户创建的设计项目，包含多个 documents 和 conversations
- **Document**: 项目内的画布文档，存储画布状态
- **Conversation**: 项目内的聊天会话
- **Message**: 聊天消息记录，包含 role（user/assistant/system）
- **Asset**: 资产文件，存储在 Supabase Storage
  - `upload` - 用户上传的文件
  - `generate` - AI 生成的图片
  - `export` - 导出的 PNG 文件
- **Job**: 异步任务，状态流转：queued → processing → done/failed
- **Plan**: AI 生成的设计方案描述，解释设计意图
- **Layer**: 画布上的图层，每个 Fabric 对象对应一个 layer

## Requirements

### Requirement 1: 项目初始化与工程结构

**User Story:** As a developer, I want a well-structured Next.js project, so that I can efficiently develop the ChatCanvas application.

#### Acceptance Criteria

1. THE Project SHALL use Next.js App Router with TypeScript
2. THE Project SHALL include Tailwind CSS for styling
3. THE Project SHALL include Zustand for state management
4. THE Project SHALL have the following directory structure:
   - `src/app/*` - 页面路由
   - `src/components/*` - UI 组件
   - `src/lib/*` - 工具函数和业务逻辑
   - `supabase/*` - 数据库 schema 和 Edge Functions
   - `docs/*` - 项目文档
5. THE Project SHALL include `.env.example` with all required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_PROVIDER` (默认 openai)
   - `AI_API_KEY`
   - `IMAGE_PROVIDER` (默认 openai)
   - `IMAGE_API_KEY`
6. WHEN running `pnpm dev`, THE System SHALL start successfully on localhost

### Requirement 2: 数据库表结构

**User Story:** As a developer, I want a well-designed database schema, so that I can store all application data efficiently.

#### Acceptance Criteria

1. THE Database SHALL have 7 tables: projects, documents, conversations, messages, assets, ops, jobs
2. THE `projects` table SHALL contain:
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `name` (text, not null)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)
3. THE `documents` table SHALL contain:
   - `id` (uuid, primary key)
   - `project_id` (uuid, references projects)
   - `name` (text)
   - `canvas_state` (jsonb, 存储画布快照)
   - `width` (integer, default 1080)
   - `height` (integer, default 1350)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)
4. THE `conversations` table SHALL contain:
   - `id` (uuid, primary key)
   - `project_id` (uuid, references projects)
   - `document_id` (uuid, references documents, nullable)
   - `created_at` (timestamptz)
5. THE `messages` table SHALL contain:
   - `id` (uuid, primary key)
   - `conversation_id` (uuid, references conversations)
   - `role` (text, enum: user/assistant/system)
   - `content` (text)
   - `metadata` (jsonb, nullable)
   - `created_at` (timestamptz)
6. THE `assets` table SHALL contain:
   - `id` (uuid, primary key)
   - `project_id` (uuid, references projects)
   - `user_id` (uuid, references auth.users)
   - `type` (text, enum: upload/generate/export)
   - `storage_path` (text, not null)
   - `filename` (text)
   - `mime_type` (text)
   - `size_bytes` (bigint)
   - `metadata` (jsonb, nullable)
   - `created_at` (timestamptz)
7. THE `ops` table SHALL contain:
   - `id` (uuid, primary key)
   - `document_id` (uuid, references documents)
   - `conversation_id` (uuid, references conversations, nullable)
   - `message_id` (uuid, references messages, nullable)
   - `seq` (bigint, auto-increment per document)
   - `op_type` (text, not null)
   - `payload` (jsonb, not null)
   - `created_at` (timestamptz)
8. THE `jobs` table SHALL contain:
   - `id` (uuid, primary key)
   - `project_id` (uuid, references projects)
   - `document_id` (uuid, references documents)
   - `user_id` (uuid, references auth.users)
   - `type` (text, enum: generate-image)
   - `status` (text, enum: queued/processing/done/failed)
   - `input` (jsonb, 任务输入参数)
   - `output` (jsonb, nullable, 任务输出结果)
   - `error` (text, nullable)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

### Requirement 3: 行级安全策略 (RLS)

**User Story:** As a user, I want my data to be secure, so that other users cannot access my projects and assets.

#### Acceptance Criteria

1. THE System SHALL enable Row Level Security on all 7 tables
2. WHEN a user queries `projects`, THE System SHALL only return rows where `user_id` equals `auth.uid()`
3. WHEN a user queries `documents`, THE System SHALL only return rows where the parent project belongs to the user
4. WHEN a user queries `conversations`, THE System SHALL only return rows where the parent project belongs to the user
5. WHEN a user queries `messages`, THE System SHALL only return rows where the parent conversation belongs to the user
6. WHEN a user queries `assets`, THE System SHALL only return rows where `user_id` equals `auth.uid()`
7. WHEN a user queries `ops`, THE System SHALL only return rows where the parent document belongs to the user
8. WHEN a user queries `jobs`, THE System SHALL only return rows where `user_id` equals `auth.uid()`
9. THE System SHALL allow INSERT/UPDATE/DELETE only for the resource owner
10. THE System SHALL use service_role key for Edge Functions to bypass RLS when needed

### Requirement 4: Storage 配置

**User Story:** As a user, I want to upload and access my files securely, so that my assets are protected.

#### Acceptance Criteria

1. THE System SHALL create a Storage bucket named `assets`
2. THE Storage path format SHALL be: `{userId}/{projectId}/{assetId}.{ext}`
3. WHEN a user uploads a file, THE System SHALL only allow upload to paths starting with their `userId`
4. WHEN a user downloads a file, THE System SHALL only allow access to paths starting with their `userId`
5. THE System SHALL support signed URLs for temporary access (默认 1 小时过期)
6. THE System SHALL support the following MIME types:
   - Images: image/png, image/jpeg, image/webp, image/gif
   - Maximum file size: 10MB

### Requirement 5: 主页布局与项目管理

**User Story:** As a user, I want a clean homepage where I can quickly start designing or access my projects.

#### Acceptance Criteria

1. WHEN a user visits `/app`, THE System SHALL display the Lovart-style homepage layout:
   - 左侧固定导航栏（首页、项目、账户图标）
   - 顶部居中的大输入框（placeholder: "让 AI 设计..."）
   - 输入框下方的快捷标签（Design、Branding、Illustration 等）
   - "最近项目" 区域显示项目网格
2. WHEN a user in the homepage input box types a prompt and presses Enter, THE System SHALL:
   - Create a new project record
   - Create a default document (1080x1350)
   - Create a default conversation with the user's prompt as first message
   - Navigate to `/app/p/[projectId]`
   - Automatically trigger AI generation with the prompt
3. WHEN a user clicks "新建项目" card, THE System SHALL:
   - Create a new project with empty canvas
   - Navigate to `/app/p/[projectId]`
4. WHEN a user clicks on a project card, THE System SHALL navigate to `/app/p/[projectId]`
5. WHEN a user deletes a project, THE System SHALL cascade delete all related documents, conversations, messages, assets, ops, and jobs
6. EACH project card SHALL display:
   - 缩略图（画布预览或默认占位图）
   - 项目名称（默认 "未命名"）
   - 更新时间（如 "更新于 2026-01-07"）
7. THE left navigation bar SHALL contain:
   - + 按钮（新建项目）
   - 首页图标
   - 项目列表图标
   - 账户图标
   - 设置图标

### Requirement 6: Canvas 编辑器布局（Lovart 风格）

**User Story:** As a user, I want an editor interface that matches Lovart's layout, so that I have a familiar and efficient design experience.

#### Acceptance Criteria

1. WHEN a user opens `/app/p/[projectId]`, THE System SHALL display the Lovart-style editor layout:
   - 左侧垂直工具栏（固定宽度约 50px）
   - 中间画布区域（占据剩余空间）
   - 右侧 Chat 面板（固定宽度约 380px，可折叠）
   - 顶部工具栏（画布操作按钮）
2. THE left toolbar SHALL contain vertical icon buttons:
   - 选择工具（箭头图标）
   - 框选工具
   - 矩形工具
   - 文字工具
   - 画笔工具（可选 MVP+）
   - 图片上传
   - AI 功能入口
3. THE top toolbar SHALL contain:
   - 项目名称（可编辑）
   - 缩放控制（- 百分比 +）
   - 画布操作按钮（放大、编辑元素、编辑文字、导出等）
4. THE right Chat panel SHALL contain:
   - 顶部标题栏（对话标题 + 操作按钮）
   - 消息列表区域（可滚动）
   - 底部输入框（带附件、表情等按钮）
5. THE canvas area SHALL:
   - 显示灰色/点阵背景
   - 居中显示画布（白色矩形）
   - 支持缩放和平移
   - 显示选中元素的尺寸信息
6. THE System SHALL be responsive and work on screens >= 1280px width
7. WHEN user clicks the collapse button on Chat panel, THE System SHALL hide the Chat panel and expand canvas area

### Requirement 7: Fabric Canvas 基础功能

**User Story:** As a user, I want to edit designs on a canvas, so that I can create and modify visual content.

#### Acceptance Criteria

1. WHEN the canvas loads, THE System SHALL initialize Fabric.js with dimensions from document (default 1080x1350)
2. WHEN a user adds a text element, THE Canvas SHALL:
   - Create an IText object with default font (Inter or system default)
   - Allow inline editing by double-click
   - Support font size, color, alignment properties
3. WHEN a user adds an image, THE Canvas SHALL:
   - Create an Image object from URL or uploaded file
   - Maintain aspect ratio by default
   - Support scaling and rotation
4. WHEN a user selects an object, THE Canvas SHALL:
   - Show selection handles (corners and edges)
   - Enable move, scale, rotate operations
   - Show object properties in a toolbar or panel
5. WHEN a user presses Delete/Backspace with selection, THE Canvas SHALL remove the selected object
6. WHEN a user presses Ctrl+Z, THE Canvas SHALL undo the last operation (via ops replay)
7. WHEN a user presses Ctrl+Y, THE Canvas SHALL redo the undone operation
8. THE Canvas SHALL support zoom (10% - 400%) via scroll wheel or controls
9. THE Canvas SHALL support pan via middle mouse button or space+drag

### Requirement 8: Canvas Ops 类型定义

**User Story:** As a developer, I want well-defined ops types, so that AI can generate valid canvas operations.

#### Acceptance Criteria

1. THE `createFrame` op SHALL accept:
   - `width` (number, required)
   - `height` (number, required)
   - `backgroundColor` (string, optional)
2. THE `setBackground` op SHALL accept:
   - `type` (enum: solid/gradient/image)
   - `value` (string for solid color, object for gradient, URL for image)
3. THE `addText` op SHALL accept:
   - `id` (string, required, unique layer identifier)
   - `text` (string, required)
   - `x` (number, required)
   - `y` (number, required)
   - `fontSize` (number, optional, default 24)
   - `fontFamily` (string, optional, default "Inter")
   - `fill` (string, optional, default "#000000")
   - `fontWeight` (string, optional)
   - `textAlign` (enum: left/center/right, optional)
   - `width` (number, optional, for text wrapping)
4. THE `addImage` op SHALL accept:
   - `id` (string, required, unique layer identifier)
   - `src` (string, required, URL or asset path)
   - `x` (number, required)
   - `y` (number, required)
   - `width` (number, optional)
   - `height` (number, optional)
   - `scaleX` (number, optional)
   - `scaleY` (number, optional)
5. THE `updateLayer` op SHALL accept:
   - `id` (string, required, target layer identifier)
   - `properties` (object, required, key-value pairs to update)
6. THE `removeLayer` op SHALL accept:
   - `id` (string, required, target layer identifier)
7. ALL ops SHALL be validated against JSON Schema before execution

### Requirement 9: OpsExecutor 实现

**User Story:** As a developer, I want an ops executor, so that ops can be reliably converted to Fabric operations.

#### Acceptance Criteria

1. WHEN OpsExecutor receives a valid ops array, THE System SHALL execute each op in sequence
2. WHEN OpsExecutor encounters an invalid op, THE System SHALL:
   - Throw a descriptive error
   - Stop execution immediately
   - Not apply any partial changes
3. WHEN executing `setBackground` with type "solid", THE System SHALL set canvas backgroundColor
4. WHEN executing `setBackground` with type "gradient", THE System SHALL create a gradient rect as background layer
5. WHEN executing `addText`, THE System SHALL create a Fabric IText object with specified properties
6. WHEN executing `addImage`, THE System SHALL:
   - Load image from URL asynchronously
   - Create Fabric Image object once loaded
   - Handle load errors gracefully
7. WHEN executing `updateLayer`, THE System SHALL find the layer by id and update specified properties
8. WHEN executing `removeLayer`, THE System SHALL find and remove the layer by id
9. THE OpsExecutor SHALL maintain a layer registry mapping id to Fabric object
10. THE OpsExecutor SHALL emit events for each executed op (for undo/redo tracking)

### Requirement 10: 图层管理（集成在工具栏）

**User Story:** As a user, I want to manage layers through the toolbar and canvas interaction, so that I can organize and edit individual design elements.

#### Acceptance Criteria

1. WHEN a user selects an element on canvas, THE System SHALL:
   - Show selection handles (corners and edges)
   - Display element info (type + dimensions) above the element
   - Show "快捷编辑 Tab" hint below the element
2. WHEN a user presses Tab with selection, THE System SHALL show quick edit options
3. WHEN a user right-clicks an element, THE System SHALL show context menu with:
   - 复制
   - 粘贴
   - 删除
   - 图层顺序（上移/下移/置顶/置底）
4. WHEN a user double-clicks a text element, THE System SHALL enter text editing mode
5. THE top toolbar "编辑元素" button SHALL open element properties panel
6. THE top toolbar "编辑文字" button SHALL be enabled when text is selected
7. WHEN canvas selection changes, THE System SHALL update toolbar button states accordingly

### Requirement 11: Chat 面板（右侧，Lovart 风格）

**User Story:** As a user, I want to chat with AI in a right-side panel to describe my design needs, so that AI can generate designs for me.

#### Acceptance Criteria

1. THE Chat panel SHALL be positioned on the right side of the editor (not left)
2. WHEN the ChatPanel loads, THE System SHALL fetch and display message history from the conversation
3. THE ChatPanel SHALL display messages in chronological order with:
   - AI 消息显示在上方，包含生成的图片预览
   - AI 消息可展开/收起详细信息（"查看完整报告"）
   - 用户消息显示为简洁的文本
4. WHEN AI generates an image, THE ChatPanel SHALL display:
   - 生成的图片缩略图（可点击查看大图）
   - AI 的解释文字
   - 设计要点说明
5. WHEN a user types a message and presses Enter (or clicks Send), THE System SHALL:
   - Create a message record with role "user"
   - Display the message immediately (optimistic update)
   - Trigger AI generation
6. THE bottom input area SHALL contain:
   - 附件按钮（上传图片）
   - @ 提及按钮
   - 输入框（placeholder: "描述你想要的设计..."）
   - 地球图标（语言选择）
   - 表情图标
   - 发送按钮
7. THE ChatPanel SHALL show a loading indicator while waiting for AI response
8. THE ChatPanel SHALL auto-scroll to the latest message
9. THE ChatPanel header SHALL contain:
   - 对话标题
   - 操作按钮（暗色模式、分享、导出等）
   - 折叠/展开按钮

### Requirement 12: AI 设计生成 (generate-ops)

**User Story:** As a user, I want AI to generate designs based on my description, so that I can quickly create visual content.

#### Acceptance Criteria

1. THE System SHALL provide an Edge Function at `POST /functions/v1/generate-ops`
2. THE request body SHALL contain:
   - `projectId` (uuid, required)
   - `documentId` (uuid, required)
   - `conversationId` (uuid, required)
   - `prompt` (string, required, user's design request)
3. WHEN the Edge Function receives a request, THE System SHALL:
   - Validate the user has access to the project
   - Construct a prompt for the LLM with system instructions
   - Call the configured AI provider (OpenAI/Anthropic/etc.)
   - Parse the LLM response as JSON
4. THE LLM response SHALL contain:
   - `plan` (string, describing the design approach)
   - `ops` (array of op objects)
5. WHEN the response is received, THE System SHALL:
   - Validate ops against JSON Schema
   - If valid, write each op to the `ops` table
   - Return `{ plan, ops }` to the client
6. IF validation fails, THEN THE System SHALL return error without writing to database
7. THE System prompt SHALL instruct the LLM to:
   - Output only valid JSON
   - Use only allowed op types
   - Provide all required fields
   - Use reasonable default values for optional fields

### Requirement 13: 文生图功能 (generate-image)

**User Story:** As a user, I want AI to generate images based on my description, so that I can add AI-generated visuals to my designs.

#### Acceptance Criteria

1. THE System SHALL provide an Edge Function at `POST /functions/v1/generate-image`
2. THE request body SHALL contain:
   - `projectId` (uuid, required)
   - `documentId` (uuid, required)
   - `prompt` (string, required, image description)
   - `width` (number, optional, default 512)
   - `height` (number, optional, default 512)
3. WHEN the Edge Function receives a request, THE System SHALL:
   - Validate the user has access to the project
   - Create a job record with status "queued"
   - Return `{ jobId }` immediately
4. THE System SHALL process the job asynchronously:
   - Update job status to "processing"
   - Call the configured image provider (OpenAI DALL-E / etc.)
   - Download the generated image
   - Upload to Storage at `{userId}/{projectId}/{assetId}.png`
   - Create an asset record with type "generate"
   - Create an `addImage` op pointing to the asset
   - Update job status to "done" with output containing assetId and ops
5. IF image generation fails, THEN THE System SHALL:
   - Update job status to "failed"
   - Store error message in job.error field
6. THE job processing SHALL complete within 60 seconds timeout

### Requirement 14: 实时更新

**User Story:** As a user, I want to see real-time updates when AI generates content, so that I have immediate feedback.

#### Acceptance Criteria

1. WHEN a user opens the editor, THE System SHALL subscribe to Realtime channels:
   - `jobs:project_id=eq.{projectId}` for job status updates
   - `ops:document_id=eq.{documentId}` for new ops
2. WHEN a job status changes to "processing", THE UI SHALL display a loading indicator
3. WHEN a job status changes to "done", THE UI SHALL:
   - Remove the loading indicator
   - Fetch the new ops from job.output or ops table
   - Execute the ops on canvas
4. WHEN a job status changes to "failed", THE UI SHALL:
   - Remove the loading indicator
   - Display an error message to the user
5. WHEN new ops are inserted, THE System SHALL:
   - Check if ops are from current session (avoid duplicate execution)
   - Execute new ops on canvas if from external source
6. THE System SHALL handle reconnection gracefully if Realtime connection drops

### Requirement 15: 导出功能

**User Story:** As a user, I want to export my designs as PNG images, so that I can use them outside the application.

#### Acceptance Criteria

1. THE System SHALL provide an Export button in the editor toolbar
2. WHEN a user clicks Export, THE System SHALL show export options:
   - Resolution: 1x, 2x, 4x
   - Format: PNG (MVP), JPEG (optional)
3. WHEN a user confirms export, THE System SHALL:
   - Generate PNG using Fabric.js toDataURL with specified multiplier
   - Convert dataURL to Blob
   - Upload to Storage at `{userId}/{projectId}/{assetId}.png`
   - Create an asset record with type "export"
   - Provide download link to user
4. THE exported image SHALL match the canvas content exactly
5. THE System SHALL show progress indicator during export
6. IF export fails, THEN THE System SHALL display an error message

### Requirement 16: Canvas Ops JSON Schema

**User Story:** As a developer, I want a strict JSON Schema for ops, so that invalid ops are rejected before execution.

#### Acceptance Criteria

1. THE System SHALL define a JSON Schema at `src/ai/schema/canvas_ops.schema.json`
2. THE Schema SHALL define the top-level structure:
   - `plan` (string, required)
   - `ops` (array, required)
3. THE Schema SHALL define each op type with:
   - Required fields
   - Optional fields with defaults
   - Field types and constraints
   - Enum values where applicable
4. THE System SHALL provide a validation function at `src/ai/schema/validate.ts`
5. WHEN validating a valid ops JSON, THE validator SHALL return `{ valid: true, data }`
6. WHEN validating an invalid ops JSON, THE validator SHALL return `{ valid: false, errors }`
7. THE validator SHALL be used in:
   - Edge Function before writing to database
   - OpsExecutor before executing ops
   - Frontend before sending to backend (optional)

### Requirement 17: Prompt 契约与对齐评测

**User Story:** As a prompt engineer, I want strict LLM 输出约束和评测基线，so that AI responses are安全、可执行、可回放。

#### Acceptance Criteria
1. THE System SHALL define a system prompt that禁止自由文本，仅返回 `{plan, ops}` JSON，包含角色设定、可用 opTypes、字段默认值、尺寸约束、资产访问约束。
2. THE System SHALL include 2-3 few-shot 示例（含渐变背景、文本换行宽度、主视觉）并声明 ID 命名规则 `layer-<short-uuid>`。
3. THE System SHALL fix采样参数：`temperature<=0.4`，`max_tokens<=900`，设置 `stop` 以防追加说明。
4. WHEN 遇到缺失关键信息或违规请求，THE System SHALL 以 `{plan:\"unable to comply: <reason>\", ops:[]}` 方式拒绝，且不写入数据库。
5. THE System SHALL maintain an离线评测集（≥20 条）验证：schema 通过率≥95%，plan 解释完整度，ops 可执行性；评测结果可回放。

### Requirement 18: 资产生命周期与治理

**User Story:** As an asset owner, I want assets to be安全、有来源、可清理，so that storage 与版权风险可控。

#### Acceptance Criteria
1. THE System SHALL 标记资产来源类型 upload/generate/export，并在 metadata 中记录 EXIF/版权/生成模型信息（如可用）。
2. THE System SHALL 保持 ops→asset→storage 一致性：任何 `addImage` op 的 src 必须是已存在且用户可访问的 Storage 路径或签名 URL。
3. THE System SHALL 支持资产配额与软删除：超过配额时阻止新上传/生成，并提供清理作业（定时删除过期的软删除资产）。
4. THE System SHALL 配置签名 URL 续期策略（默认 1 小时，可续期），并防止跨用户访问。
5. THE System SHALL 对上传/生成图片进行安全/版权扫描（可调用外部服务或占位策略），命中时拒绝写入 ops。

### Requirement 19: 可靠性与幂等保障

**User Story:** As a user, I want repeated请求或断线重放时系统保持一致，so that画布与资产不会重复或损坏。

#### Acceptance Criteria
1. THE System SHALL treat `ops.seq` as幂等键：同一 document_id+seq 的 ops 只执行一次；重复写入/订阅不产生重复图层。
2. WHEN Realtime 重连或客户端重放历史 ops，THE System SHALL 执行去重并保证最终画布状态与单次执行一致。
3. THE job/state 处理 SHALL 具备有界重试（可配置最大次数、退避），不得生成重复 asset/op；失败后提供明确错误状态。
