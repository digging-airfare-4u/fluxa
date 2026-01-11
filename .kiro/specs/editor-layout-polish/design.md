# Design Document: Editor Layout Polish

## Overview

本设计文档描述了编辑器界面布局优化的技术实现方案。目标是在保持现有代码结构的前提下，通过 CSS 样式调整和组件优化，使界面与参考截图高度一致。

主要改动策略：
1. **CSS 优先** - 能用样式解决的不改组件逻辑
2. **复用 shadcn** - 使用 Collapsible、Separator、Avatar 等组件
3. **最小侵入** - 不改变现有数据流和业务逻辑

## Architecture

### 组件层级结构

```
EditorLayout
├── TopToolbar (样式调整 + Separator 分组)
├── LeftToolbar (保持不变)
├── CanvasStage (保持不变)
└── ChatPanel (宽度调整)
    ├── ChatPanelHeader (操作按钮布局)
    ├── MessageList
    │   ├── ChatMessage (样式重构)
    │   │   ├── UserMessage (蓝色边框风格)
    │   │   ├── AIMessage (模型标识 + 图片卡片)
    │   │   └── MessageActions (hover 操作按钮)
    │   └── CollapsibleSection (新增，使用 shadcn Collapsible)
    └── ChatInput (按钮布局优化)
```

### 改动范围

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `globals.css` | CSS 修改 | 消息样式、面板宽度 |
| `ChatMessage.tsx` | 组件修改 | 添加模型标识、操作按钮 |
| `ChatPanel.tsx` | 组件修改 | 宽度调整、CollapsibleSection |
| `ChatInput.tsx` | 样式调整 | 按钮布局微调 |
| `TopToolbar.tsx` | 组件修改 | 添加 Separator 分组 |
| `ui/collapsible.tsx` | 新增组件 | shadcn Collapsible |
| `ui/separator.tsx` | 新增组件 | shadcn Separator |

## Components and Interfaces

### 1. ChatMessage 组件重构

```typescript
interface ChatMessageProps {
  message: Message;
  modelName?: string; // AI 模型名称，如 "Nano Banana Pro"
  onImageClick?: (imageUrl: string) => void;
  onImageDownload?: (imageUrl: string) => void;
  onAddToCanvas?: (imageUrl: string) => void;
  onCopy?: () => void; // 复制消息
  onEdit?: () => void; // 编辑消息
}
```

### 2. CollapsibleSection 组件（新增）

使用 shadcn Collapsible 组件封装：

```typescript
interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

### 3. MessageActions 组件（新增）

```typescript
interface MessageActionsProps {
  onCopy: () => void;
  onEdit?: () => void;
  visible: boolean;
}
```

## Data Models

### Message Metadata 扩展

```typescript
interface MessageMetadata {
  plan?: string;
  ops?: Op[];
  imageUrl?: string;
  isPending?: boolean;
  modelName?: string; // 新增：AI 模型名称
  structuredInfo?: {   // 新增：可折叠信息块数据
    title: string;
    content: string;
  }[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: AI 消息图片渲染一致性

*For any* AI message with image metadata, the ChatMessage component SHALL render an ImageCard component with the image URL and proper styling.

**Validates: Requirements 2.2**

### Property 2: CollapsibleSection 状态切换

*For any* CollapsibleSection component, clicking the trigger SHALL toggle the open state, and the content visibility SHALL match the open state.

**Validates: Requirements 3.3**

### Property 3: 消息操作按钮交互

*For any* user message with action buttons, clicking the copy button SHALL invoke the onCopy callback with the message content.

**Validates: Requirements 6.2**

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| 图片加载失败 | 显示占位图 + 重试按钮 |
| 复制失败 | 显示 toast 提示 |
| 模型名称缺失 | 显示默认名称 "AI Assistant" |

## Testing Strategy

### 单元测试

- ChatMessage 组件渲染测试（用户消息 vs AI 消息）
- CollapsibleSection 状态切换测试
- MessageActions 点击事件测试

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1**: 验证 AI 消息图片渲染
2. **Property 2**: 验证 CollapsibleSection 状态切换
3. **Property 3**: 验证消息操作按钮交互

### 视觉回归测试

- 用户消息蓝色边框样式
- AI 消息模型标识显示
- ChatPanel 宽度 400px
- TopToolbar Separator 分组

## Implementation Notes

### shadcn 组件安装

需要安装以下 shadcn 组件：

```bash
pnpm dlx shadcn@latest add collapsible separator avatar
```

### CSS 变量新增

```css
/* 用户消息边框颜色 */
--color-user-message-border: #3B82F6;

/* 消息操作按钮 */
--color-action-button-bg: rgba(0, 0, 0, 0.05);
--color-action-button-hover: rgba(0, 0, 0, 0.1);
```

### 动画配置

CollapsibleSection 展开/收起动画使用 Radix UI 内置动画，配合 Tailwind 的 `data-[state=open]` 和 `data-[state=closed]` 选择器。

