# Requirements Document

## Introduction

本需求文档定义了编辑器界面布局优化的功能需求，目标是在不推翻现有结构的前提下，将界面调整为与参考截图高度一致的布局和体验。主要涉及 ChatPanel、TopToolbar、消息样式等组件的视觉和交互优化。

## Glossary

- **ChatPanel**: 右侧聊天面板组件，包含消息列表和输入区域
- **TopToolbar**: 顶部工具栏组件，包含项目名称、缩放控制和操作按钮
- **ChatMessage**: 聊天消息组件，显示用户和 AI 的消息
- **ChatInput**: 聊天输入组件，用于输入和发送消息
- **CollapsibleSection**: 可折叠信息块组件，用于显示可展开/收起的内容
- **ImageCard**: 图片卡片组件，用于显示 AI 生成的图片预览

## Requirements

### Requirement 1: 用户消息样式优化

**User Story:** As a user, I want user messages to have a distinct blue border style, so that I can easily distinguish my messages from AI responses.

#### Acceptance Criteria

1. WHEN a user message is displayed, THE ChatMessage SHALL render with a blue border (1.5px solid #3B82F6) and transparent background
2. WHEN a user message is displayed, THE ChatMessage SHALL have rounded corners (12px border-radius)
3. WHEN a user message is displayed, THE ChatMessage SHALL align to the right side of the chat panel

### Requirement 2: AI 消息样式优化

**User Story:** As a user, I want AI messages to display with a model identifier and cleaner layout, so that I can identify the AI source and read responses easily.

#### Acceptance Criteria

1. WHEN an AI message is displayed, THE ChatMessage SHALL show the AI model name (e.g., "Nano Banana Pro") above the message content
2. WHEN an AI message contains an image, THE ChatMessage SHALL display the image in a standalone card with a title bar
3. WHEN an AI message is displayed, THE ChatMessage SHALL have a transparent background without visible borders

### Requirement 3: 可折叠信息块

**User Story:** As a user, I want to see collapsible information sections in chat, so that I can expand details when needed without cluttering the interface.

#### Acceptance Criteria

1. WHEN AI provides structured information, THE ChatPanel SHALL display it in a CollapsibleSection component
2. WHEN a CollapsibleSection is collapsed, THE System SHALL show only the section title with an expand indicator
3. WHEN a user clicks on a CollapsibleSection, THE System SHALL toggle between expanded and collapsed states with smooth animation
4. WHEN a CollapsibleSection is expanded, THE System SHALL display the full content with proper formatting

### Requirement 4: ChatPanel 布局优化

**User Story:** As a user, I want the chat panel to have optimized dimensions and spacing, so that the interface feels balanced and professional.

#### Acceptance Criteria

1. THE ChatPanel SHALL have a width of 400px (increased from 380px)
2. WHEN the chat panel header is displayed, THE System SHALL show action buttons (share, download, collapse) aligned to the right
3. WHEN messages are displayed, THE ChatPanel SHALL maintain consistent padding (16px) around the message area

### Requirement 5: ChatInput 布局优化

**User Story:** As a user, I want the input area to have a cleaner layout with accessible action buttons, so that I can easily compose and send messages.

#### Acceptance Criteria

1. WHEN the input area is displayed, THE ChatInput SHALL show attachment and @ buttons on the left side
2. WHEN the input area is displayed, THE ChatInput SHALL show emoji and send buttons on the right side
3. WHEN the input field is focused, THE ChatInput SHALL display a subtle focus ring effect
4. THE ChatInput placeholder SHALL display "请输入你的设计需求" (or similar prompt text)

### Requirement 6: 消息操作按钮

**User Story:** As a user, I want quick action buttons on messages, so that I can easily copy, edit, or perform other actions on messages.

#### Acceptance Criteria

1. WHEN a user message is displayed, THE ChatMessage SHALL show action buttons (copy, edit) in the top-right corner on hover
2. WHEN an action button is clicked, THE System SHALL perform the corresponding action (copy to clipboard, enter edit mode)
3. WHEN not hovering over a message, THE action buttons SHALL be hidden to maintain a clean interface

### Requirement 7: TopToolbar 工具组优化

**User Story:** As a user, I want the top toolbar to have organized tool groups, so that I can access canvas tools efficiently.

#### Acceptance Criteria

1. WHEN the top toolbar is displayed, THE TopToolbar SHALL show the project name on the left with a back button
2. WHEN the top toolbar is displayed, THE TopToolbar SHALL show canvas tools (group, merge, brush, shape, dimensions) in the center
3. WHEN the top toolbar is displayed, THE TopToolbar SHALL show zoom controls and export button on the right
4. THE TopToolbar tool groups SHALL be visually separated using Separator components

