# Implementation Plan: ChatCanvas

## Overview

本实现计划按照 Pipeline 定义的 Phase 顺序，将 ChatCanvas 功能分解为可执行的编码任务。每个任务都有明确的输入/输出和验收标准。

## Tasks

- [x] 1. Phase 0: 项目初始化
  - [x] 1.1 初始化 Next.js 工程骨架
    - 创建 Next.js App Router 项目
    - 配置 TypeScript、Tailwind CSS
    - 安装 Zustand、Fabric.js 依赖
    - 安装 lucide-react 图标库
    - 创建目录结构：src/app, src/components, src/lib, supabase, docs
    - 创建 .env.example 包含所有环境变量
    - **UI 配置**:
      - 配置 Tailwind 扩展颜色（primary: #7C3AED, accent: #06B6D4）
      - 添加 Google Fonts（Space Grotesk + DM Sans）
      - 配置字体 fontFamily（heading + body）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
    - _UI Style: Minimalism + Glassmorphism, AI/Chatbot Platform 配色, Tech Startup 字体_

- [x] 2. Phase 1: Supabase Schema + RLS + Storage
  - [x] 2.1 创建数据库表结构
    - 编写 supabase/schema.sql
    - 创建 7 张表：projects, documents, conversations, messages, assets, ops, jobs
    - 添加索引和外键约束 
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 2.2 配置行级安全策略 (RLS)
    - 编写 supabase/rls.sql
    - 为每张表启用 RLS
    - 创建 SELECT/INSERT/UPDATE/DELETE 策略
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 2.3 编写 RLS 属性测试
    - **Property 1: Data Isolation**
    - **Validates: Requirements 3.2-3.9**

  - [x] 2.4 配置 Storage bucket 和策略
    - 编写 supabase/storage.sql
    - 创建 assets bucket
    - 配置路径访问策略
    - 编写 docs/storage.md 文档
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 2.5 资产生命周期与配额治理
    - 记录资产来源/EXIF/版权/生成模型元数据
    - 实现配额校验、软删除与定时清理作业
    - 配置签名 URL 续期策略与跨用户隔离
    - 集成或预留安全/版权扫描钩子，违规阻断写入 ops
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 3. Phase 2: Canvas MVP（前端）
  - [x] 3.1 实现 Fabric Canvas 基础组件
    - 创建 src/components/canvas/CanvasStage.tsx
    - 初始化 Fabric.js canvas (1080x1350)
    - 实现基础交互：选择、移动、缩放、删除
    - 实现缩放和平移控制
    - _Requirements: 7.1, 7.4, 7.5, 7.8, 7.9_

  - [x] 3.2 实现 Canvas 导出功能
    - 创建 src/lib/canvas/export.ts
    - 实现 toDataURL 导出 PNG (1x/2x/4x)
    - _Requirements: 15.3, 15.4_

  - [x] 3.3 定义 Canvas Ops 类型
    - 创建 src/lib/canvas/ops.types.ts
    - 定义所有 Op 类型接口
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 3.4 实现 OpsExecutor
    - 创建 src/lib/canvas/opsExecutor.ts
    - 实现 setBackground 处理器
    - 实现 addText 处理器
    - 实现 addImage 处理器
    - 实现 updateLayer 处理器
    - 实现 removeLayer 处理器
    - 维护 layer registry
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 3.5 编写 OpsExecutor 属性测试
    - **Property 3: Ops Execution Correctness**
    - **Property 4: Layer Registry Consistency**
    - **Property 10: Invalid Op Rejection**
    - **Validates: Requirements 9.1-9.9**

  - [x] 3.6 实现元素选择交互
    - 选中元素显示尺寸信息
    - 显示"快捷编辑 Tab"提示
    - 右键菜单（复制、粘贴、删除、图层顺序）
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 4. Checkpoint - Canvas MVP 验证
  - 确保画布可以手动添加元素
  - 确保 OpsExecutor 可以执行 ops JSON
  - 确保导出 PNG 功能正常
  - 如有问题请询问用户

- [x] 5. Phase 3: Chat MVP
  - [x] 5.1 配置 Supabase 客户端
    - 创建 src/lib/supabase/client.ts
    - 配置 Auth 和 Realtime
    - _Requirements: 3.10_

  - [x] 5.2 实现消息查询函数
    - 创建 src/lib/supabase/queries/messages.ts
    - 实现 fetchMessages, createMessage
    - _Requirements: 11.1_

  - [x] 5.3 实现 ChatPanel 组件（右侧面板）
    - 创建 src/components/chat/ChatPanel.tsx
    - 创建 src/components/chat/ChatMessage.tsx
    - 创建 src/components/chat/ChatInput.tsx
    - 右侧面板布局，可折叠
    - 加载历史消息
    - 发送消息并持久化
    - 显示 AI 生成的图片预览
    - **UI**: 使用 `.chat-panel` 毛玻璃样式，`.chat-message-ai` 和 `.chat-message-user` 消息样式
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

- [x] 6. Phase 4: AI Agent（Plan + Ops）
  - [x] 6.1 定义 Canvas Ops JSON Schema
    - 创建 src/ai/schema/canvas_ops.schema.json
    - 定义 plan + ops 结构
    - 定义每种 op 类型的 schema
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 6.2 实现 Schema 验证函数
    - 创建 src/ai/schema/validate.ts
    - 使用 ajv 或 zod 实现验证
    - 返回 { valid, data/errors }
    - _Requirements: 16.4, 16.5, 16.6, 16.7_

  - [x] 6.3 编写 Schema 验证属性测试
    - **Property 2: Ops Schema Validation Round-Trip**
    - **Validates: Requirements 8.7, 12.6, 16.5, 16.6**

  - [x] 6.4 实现 generate-ops Edge Function
    - 创建 supabase/functions/generate-ops/index.ts
    - 验证用户权限
    - 构建 LLM prompt
    - 调用 AI provider
    - 验证响应 schema
    - 写入 ops 表
    - 更新 docs/api.md
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  - [x] 6.5 LLM Prompt 基线与离线评测
    - 定义 system prompt、few-shot 示例、采样参数、拒绝策略
    - 构建 ≥20 条评测集，验证 schema 通过率与 plan 完整度
    - 记录评测结果并迭代 prompt
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 7. Checkpoint - AI 生成验证
  - 确保 generate-ops 返回有效 ops
  - 确保前端可以执行返回的 ops
  - 确保画布正确渲染生成的设计
  - 如有问题请询问用户

- [-] 8. Phase 5: 文生图（异步 Jobs）
  - [x] 8.1 实现 generate-image Edge Function
    - 创建 supabase/functions/generate-image/index.ts
    - 创建 job 记录 (queued)
    - 异步处理：调用图片 API → 上传 Storage → 创建 asset → 创建 addImage op
    - 更新 job 状态 (processing → done/failed)
    - 更新 docs/api.md
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 8.2 编写 Job 状态机属性测试
    - **Property 8: Job State Machine**
    - **Validates: Requirements 13.3, 13.4, 13.5**

- [x] 9. Phase 6: Realtime 订阅
  - [x] 9.1 实现 Jobs 订阅
    - 创建 src/lib/realtime/subscribeJobs.ts
    - 订阅 jobs 表变更
    - 处理状态更新 UI
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 9.2 实现 Ops 订阅
    - 创建 src/lib/realtime/subscribeOps.ts
    - 订阅 ops 表新增
    - 自动执行新 ops
    - _Requirements: 14.5, 14.6_
  - [x] 9.3 幂等与去重保障
    - Ops seq 去重执行，重连重放不产生重复图层
    - Job 重试有界且不重复生成资产/ops
    - _Requirements: 19.1, 19.2, 19.3_

- [-] 10. Phase 7: 导出与资产闭环
  - [ ] 10.1 实现导出并上传功能
    - 创建 src/lib/export/exportAndUpload.ts
    - 生成 PNG → 上传 Storage → 创建 asset 记录
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 10.2 实现 ExportButton 组件
    - 创建 src/components/export/ExportButton.tsx
    - 显示导出选项 (1x/2x/4x)
    - 显示进度和下载链接
    - _Requirements: 15.1, 15.2, 15.5, 15.6_

  - [ ] 10.3 编写导出保真度属性测试
    - **Property 9: Export Fidelity**
    - **Validates: Requirements 15.4**

- [-] 11. Phase 8: 主页（Lovart 风格）
  - [x] 11.1 实现左侧导航栏
    - 创建 src/components/layout/LeftSidebar.tsx
    - 固定宽度 56px，垂直图标按钮
    - **UI**: 使用 `.left-sidebar` 样式，lucide-react 图标
    - _Requirements: 5.7_

  - [x] 11.2 实现主页输入框组件
    - 创建 src/components/home/HomeInput.tsx
    - 居中大输入框，支持直接输入 prompt
    - 创建 src/components/home/QuickTags.tsx 快捷标签
    - **UI**: 使用 `.home-input` 样式，圆角 rounded-2xl，阴影效果
    - _Requirements: 5.1, 5.2_

  - [x] 11.3 实现项目网格
    - 创建 src/components/home/ProjectGrid.tsx
    - 显示项目卡片（缩略图、名称、更新时间）
    - **UI**: 使用 `.project-card` 样式，hover 效果
    - _Requirements: 5.6_

  - [x] 11.4 实现主页快速生成流程
    - 主页输入 prompt → 创建项目 → 跳转编辑器 → 自动触发 AI
    - _Requirements: 5.2_

  - [x] 11.5 编写项目创建属性测试
    - **Property 5: Project Creation Invariant**
    - **Validates: Requirements 5.3**

  - [ ] 11.6 实现项目删除功能
    - 实现级联删除
    - _Requirements: 5.5_

  - [ ] 11.7 编写级联删除属性测试
    - **Property 6: Cascade Delete Completeness**
    - **Validates: Requirements 5.5**

- [x] 12. Phase 9: 编辑器页面（Lovart 风格）
  - [x] 12.1 实现左侧工具栏
    - 创建 src/components/editor/LeftToolbar.tsx
    - 垂直图标按钮（选择、框选、矩形、文字、图片、AI）
    - **UI**: 使用 `.editor-toolbar` 和 `.tool-button` 样式，浮动圆角面板
    - _Requirements: 6.2_

  - [x] 12.2 实现顶部工具栏
    - 创建 src/components/editor/TopToolbar.tsx
    - 项目名称、缩放控制、操作按钮
    - **UI**: 使用 `.top-toolbar` 样式，毛玻璃效果
    - _Requirements: 6.3_

  - [x] 12.3 实现编辑器整体布局
    - 创建 src/components/editor/EditorLayout.tsx
    - 创建 src/app/app/p/[projectId]/page.tsx
    - 三栏布局：LeftToolbar | Canvas | ChatPanel
    - **UI**: 画布区域使用 `.canvas-container` 点阵背景
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.7_

  - [x] 12.4 集成所有组件
    - 连接 ChatPanel 到 generate-ops
    - 连接 OpsExecutor 到 Canvas
    - 连接 Realtime 订阅
    - _Requirements: 11.5, 14.3_

- [ ] 13. Final Checkpoint - MVP 完整验证
  - 确保完整用户流程：Chat → AI 生成 → 画布渲染 → 导出
  - 确保文生图异步流程正常
  - 确保所有属性测试通过
  - 如有问题请询问用户

## Notes

- 所有任务都是必须执行的，包括属性测试
- 每个 Checkpoint 用于验证阶段性成果
- 属性测试使用 fast-check 库，每个测试至少运行 100 次
- 所有 Edge Functions 使用 Deno runtime

---

## UI/UX 设计约束（UI Pro Max - 方案 A）

### 设计风格
- **主风格**: Minimalism & Swiss Style - 干净、功能性、大量留白、高对比度
- **辅助风格**: Glassmorphism - 右侧 Chat 面板使用毛玻璃效果

### 配色方案（AI/Chatbot Platform #19）
```css
:root {
  --color-primary: #7C3AED;      /* 紫色 - 主色调 */
  --color-secondary: #A78BFA;    /* 浅紫色 */
  --color-cta: #06B6D4;          /* 青色 - CTA 按钮 */
  --color-background: #FAF5FF;   /* 淡紫背景 */
  --color-surface: #FFFFFF;      /* 卡片/面板背景 */
  --color-text-primary: #1E1B4B; /* 深紫文字 */
  --color-text-secondary: #6B7280;
  --color-border: #DDD6FE;       /* 边框色 */
}
```

### Tailwind 配置
```js
// tailwind.config.js 扩展
colors: {
  primary: {
    DEFAULT: '#7C3AED',
    50: '#FAF5FF',
    100: '#F3E8FF',
    500: '#A78BFA',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  accent: '#06B6D4',
}
```

### 字体方案（Tech Startup #3）
```css
/* Google Fonts 导入 */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* Tailwind 配置 */
fontFamily: {
  heading: ['Space Grotesk', 'sans-serif'],
  body: ['DM Sans', 'sans-serif'],
}
```

### 组件样式规范

#### 1. 主页输入框
```css
/* 大输入框 - 居中、圆角、阴影 */
.home-input {
  @apply w-full max-w-2xl px-6 py-4 
         bg-white rounded-2xl 
         border border-gray-200
         shadow-lg shadow-primary-100/50
         focus:ring-2 focus:ring-primary-500 focus:border-transparent
         text-lg placeholder:text-gray-400;
}
```

#### 2. 左侧导航栏
```css
/* 固定宽度、垂直图标、简洁 */
.left-sidebar {
  @apply w-14 h-screen fixed left-0 top-0
         bg-white border-r border-gray-100
         flex flex-col items-center py-4 gap-2;
}
.sidebar-icon {
  @apply w-10 h-10 rounded-xl 
         flex items-center justify-center
         text-gray-500 hover:bg-primary-50 hover:text-primary-600
         transition-colors duration-200;
}
```

#### 3. 项目卡片
```css
/* 圆角、悬浮效果 */
.project-card {
  @apply bg-white rounded-2xl overflow-hidden
         border border-gray-100
         hover:shadow-lg hover:shadow-primary-100/30
         hover:border-primary-200
         transition-all duration-200 cursor-pointer;
}
```

#### 4. 右侧 Chat 面板（Glassmorphism）
```css
/* 毛玻璃效果 */
.chat-panel {
  @apply w-[380px] h-full fixed right-0 top-0
         bg-white/80 backdrop-blur-xl
         border-l border-white/20
         shadow-[-4px_0_24px_rgba(124,58,237,0.1)];
}
.chat-message-ai {
  @apply bg-primary-50/80 backdrop-blur-sm
         rounded-2xl p-4 max-w-[90%];
}
.chat-message-user {
  @apply bg-white rounded-2xl p-4 max-w-[90%]
         border border-gray-100;
}
```

#### 5. 左侧工具栏（编辑器）
```css
.editor-toolbar {
  @apply w-12 h-auto fixed left-0 top-1/2 -translate-y-1/2
         bg-white rounded-2xl shadow-lg
         border border-gray-100
         flex flex-col items-center py-3 gap-1 mx-3;
}
.tool-button {
  @apply w-9 h-9 rounded-xl
         flex items-center justify-center
         text-gray-500 hover:bg-primary-50 hover:text-primary-600
         transition-colors duration-200;
}
.tool-button.active {
  @apply bg-primary-100 text-primary-600;
}
```

#### 6. 顶部工具栏（编辑器）
```css
.top-toolbar {
  @apply h-14 w-full fixed top-0 left-0
         bg-white/90 backdrop-blur-sm
         border-b border-gray-100
         flex items-center justify-between px-4;
}
```

#### 7. 画布区域
```css
.canvas-container {
  @apply flex-1 bg-gray-50 
         overflow-hidden relative;
  /* 点阵背景 */
  background-image: radial-gradient(circle, #E5E7EB 1px, transparent 1px);
  background-size: 20px 20px;
}
```

#### 8. 按钮样式
```css
/* Primary CTA */
.btn-primary {
  @apply px-6 py-2.5 rounded-xl
         bg-primary-600 text-white font-medium
         hover:bg-primary-700
         transition-colors duration-200
         shadow-lg shadow-primary-500/25;
}
/* Secondary */
.btn-secondary {
  @apply px-6 py-2.5 rounded-xl
         bg-white text-gray-700 font-medium
         border border-gray-200
         hover:bg-gray-50
         transition-colors duration-200;
}
/* Accent CTA */
.btn-accent {
  @apply px-6 py-2.5 rounded-xl
         bg-accent text-white font-medium
         hover:bg-cyan-600
         transition-colors duration-200;
}
```

### UX 指南约束

1. **动画时长**: 使用 150-300ms，避免超过 500ms
2. **圆角**: 统一使用 `rounded-xl`(12px) 或 `rounded-2xl`(16px)
3. **阴影**: 使用带颜色的阴影 `shadow-primary-100/50`
4. **间距**: 使用 Tailwind 默认间距，保持一致性
5. **触摸目标**: 最小 44x44px
6. **对比度**: 确保文字对比度 >= 4.5:1
7. **Loading 状态**: 使用 skeleton 或 spinner
8. **Focus 状态**: 使用 `focus:ring-2 focus:ring-primary-500`
9. **Hover 状态**: 使用 200ms 过渡
10. **响应式**: 最小支持 1280px 宽度

### 图标库
推荐使用 `lucide-react` 或 `@heroicons/react`，保持线性风格（outline）
