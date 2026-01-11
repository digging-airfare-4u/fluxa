# Implementation Plan: Editor Layout Polish

## Overview

本任务清单按照最小改动原则，分步骤实现编辑器界面布局优化。优先处理 CSS 样式调整，然后是组件修改，最后是新组件添加。

## Tasks

- [x] 1. 安装 shadcn 组件
  - 安装 collapsible 和 separator 组件
  - 验证组件正确安装到 `src/components/ui/`
  - _Requirements: 3.1, 7.4_

- [x] 2. CSS 样式调整
  - [x] 2.1 修改用户消息样式
    - 更新 `.chat-message-user` 为蓝色边框风格
    - 设置 `border: 1.5px solid #3B82F6`
    - 设置 `background: transparent`
    - 设置 `border-radius: 12px`
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 修改 AI 消息样式
    - 更新 `.chat-message-ai` 为透明背景
    - 移除边框样式
    - _Requirements: 2.3_

  - [x] 2.3 调整 ChatPanel 宽度
    - 修改 `.chat-panel` 宽度为 400px
    - 同步更新 `EditorLayout` 中的 marginRight 值
    - 同步更新 `TopToolbar` 中的 mr 值
    - _Requirements: 4.1_

- [x] 3. ChatMessage 组件优化
  - [x] 3.1 添加 AI 模型名称显示
    - 在 AI 消息顶部添加模型名称标识
    - 使用小字体和次要颜色
    - _Requirements: 2.1_

  - [x] 3.2 添加消息操作按钮
    - 创建 MessageActions 子组件
    - 实现 hover 显示/隐藏逻辑
    - 添加复制和编辑按钮
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 3.3 编写 ChatMessage 单元测试
    - 测试用户消息渲染
    - 测试 AI 消息渲染
    - 测试操作按钮交互
    - _Requirements: 6.2_

- [x] 4. CollapsibleSection 组件
  - [x] 4.1 创建 CollapsibleSection 组件
    - 基于 shadcn Collapsible 封装
    - 实现标题和展开/收起指示器
    - 添加平滑动画效果
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 集成到 ChatPanel
    - 在 AI 消息中使用 CollapsibleSection 显示结构化信息
    - 替换现有的展开/收起逻辑
    - _Requirements: 3.1_

  - [ ]* 4.3 编写 CollapsibleSection 属性测试
    - **Property 2: CollapsibleSection 状态切换**
    - **Validates: Requirements 3.3**

- [x] 5. TopToolbar 优化
  - [x] 5.1 添加 Separator 分组
    - 在工具组之间添加 Separator 组件
    - 调整按钮间距和布局
    - _Requirements: 7.4_

  - [x] 5.2 调整工具栏布局
    - 确保项目名称在左侧
    - 确保缩放控制在中间
    - 确保导出按钮在右侧
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. ChatInput 布局微调
  - [x] 6.1 调整按钮布局
    - 确保附件和 @ 按钮在左侧
    - 确保表情和发送按钮在右侧
    - _Requirements: 5.1, 5.2_

  - [x] 6.2 优化输入框样式
    - 调整 placeholder 文本
    - 确保 focus 状态有正确的 ring 效果
    - _Requirements: 5.3, 5.4_

- [x] 7. Checkpoint - 验证所有改动
  - 确保所有样式正确应用
  - 确保组件交互正常
  - 确保无 TypeScript 错误
  - 询问用户是否有问题

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 进度
- 每个任务完成后应验证无破坏性改动
- CSS 改动优先，因为风险最低
- shadcn 组件安装是前置依赖，必须先完成

