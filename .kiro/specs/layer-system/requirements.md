# Requirements Document

## Introduction

Fluxa 图层系统（Layer System）为画布引入图层抽象，实现每个画布元素与图层的一一映射。本期 MVP 聚焦于：图层生成、隐藏/显示、锁定/解锁、选中联动四个核心能力，为未来排序/分组/协作等高级功能奠定架构基础。

核心设计原则：
- 画布负责渲染，图层负责语义
- 图层是业务一等公民，不依赖 Fabric 内部状态
- 所有隐藏/锁定操作先改图层，再同步画布
- 单一选中源（Canvas / Layer Panel 二选一）

## Glossary

- **Layer**: 图层，画布元素的业务抽象，包含 id、name、type、visible、locked 属性
- **Layer_Panel**: 图层面板，展示所有图层列表的 UI 组件
- **Layer_Panel_Toggle**: 图层面板切换按钮，位于画布左下角，用于展开/收起图层面板
- **Canvas_Object**: Fabric.js 画布对象，仅用于渲染和交互
- **Layer_Store**: 图层状态管理器，使用 Zustand 管理所有图层状态
- **Selection_State**: 选中状态，记录当前选中的图层/画布对象
- **Op**: 画布操作，存储在 ops 表中的离散操作记录
- **Ops_Replay**: 操作重放，按序列号顺序执行所有 ops 以重建画布和图层状态

## Requirements

### Requirement 1: 图层数据模型

**User Story:** As a developer, I want a stable Layer data model, so that all canvas elements have consistent business semantics independent of Fabric.js.

#### Acceptance Criteria

1. THE Layer SHALL contain the following properties: id (string, unique), name (string), type (enum: 'rect' | 'text' | 'image'), visible (boolean), locked (boolean)
2. THE Layer SHALL maintain a stable unique id that persists across sessions
3. THE Layer SHALL store a reference to its corresponding Canvas_Object id
4. WHEN a Layer is created, THE Layer_Store SHALL assign a default name based on type and creation order (e.g., "矩形 1", "文字 2", "图片 3")
5. WHEN a Layer is created, THE Layer_Store SHALL set visible to true and locked to false by default

### Requirement 2: 图层自动生成

**User Story:** As a user, I want layers to be automatically created when I add canvas elements, so that I don't need to manually manage layer creation.

#### Acceptance Criteria

1. WHEN a user draws a rectangle on the canvas, THE Layer_Store SHALL automatically create a corresponding Layer with type 'rect'
2. WHEN a user creates a text element on the canvas, THE Layer_Store SHALL automatically create a corresponding Layer with type 'text'
3. WHEN a user adds an image to the canvas (via upload or AI generation), THE Layer_Store SHALL automatically create a corresponding Layer with type 'image'
4. WHEN a Canvas_Object is created, THE Layer_Store SHALL establish a bidirectional mapping between the Layer and Canvas_Object
5. WHEN a Canvas_Object is deleted, THE Layer_Store SHALL remove the corresponding Layer
6. WHEN a user manually creates a rectangle, THE system SHALL persist an `addRect` Op to the ops table
7. WHEN a user manually creates a text element, THE system SHALL persist an `addText` Op to the ops table

### Requirement 3: 图层面板展示

**User Story:** As a user, I want to see all layers in a panel, so that I can manage and interact with canvas elements through a structured list.

#### Acceptance Criteria

1. THE Layer_Panel SHALL display all layers in a vertical list
2. THE Layer_Panel SHALL show each layer's name, visibility toggle, and lock toggle
3. THE Layer_Panel SHALL visually indicate the currently selected layer with highlight styling
4. WHEN the Layer_Store updates, THE Layer_Panel SHALL re-render to reflect the current state
5. THE Layer_Panel SHALL be hidden by default when the editor loads
6. THE Layer_Panel_Toggle SHALL be positioned at the bottom-left corner of the canvas area
7. WHEN a user clicks the Layer_Panel_Toggle, THE Layer_Panel SHALL toggle between visible and hidden states
8. THE Layer_Panel_Toggle SHALL display an icon indicating the current panel state (e.g., layers icon)

### Requirement 4: 图层隐藏/显示

**User Story:** As a user, I want to hide and show layers, so that I can focus on specific elements without deleting others.

#### Acceptance Criteria

1. WHEN a user toggles a Layer's visibility to hidden, THE Layer_Store SHALL set the Layer's visible property to false
2. WHEN a Layer's visible property changes to false, THE Canvas_Object SHALL become invisible on the canvas
3. WHILE a Layer is hidden, THE Canvas_Object SHALL NOT be selectable by any canvas interaction
4. WHEN a user toggles a Layer's visibility to visible, THE Layer_Store SHALL set the Layer's visible property to true
5. WHEN a Layer's visible property changes to true, THE Canvas_Object SHALL become visible and selectable on the canvas
6. IF a hidden Layer is currently selected, THEN THE Selection_State SHALL deselect it immediately

### Requirement 5: 图层锁定/解锁

**User Story:** As a user, I want to lock and unlock layers, so that I can prevent accidental modifications to specific elements.

#### Acceptance Criteria

1. WHEN a user toggles a Layer's lock state to locked, THE Layer_Store SHALL set the Layer's locked property to true
2. WHEN a Layer's locked property changes to true, THE Canvas_Object SHALL NOT be selectable on the canvas
3. WHILE a Layer is locked, THE Canvas_Object SHALL NOT respond to drag, resize, or edit interactions
4. WHEN a user toggles a Layer's lock state to unlocked, THE Layer_Store SHALL set the Layer's locked property to false
5. WHEN a Layer's locked property changes to false, THE Canvas_Object SHALL become selectable and editable on the canvas
6. IF a locked Layer is currently selected, THEN THE Selection_State SHALL deselect it immediately

### Requirement 6: 选中状态联动

**User Story:** As a user, I want layer selection and canvas selection to stay synchronized, so that I have a consistent editing experience.

#### Acceptance Criteria

1. WHEN a user selects a Canvas_Object on the canvas, THE Layer_Panel SHALL highlight the corresponding Layer
2. WHEN a user clicks a Layer in the Layer_Panel, THE Canvas_Object SHALL become selected on the canvas
3. WHEN a user deselects all Canvas_Objects, THE Layer_Panel SHALL remove all layer highlights
4. WHILE a Layer is hidden, THE Layer SHALL NOT be selectable via Layer_Panel click
5. WHILE a Layer is locked, THE Layer SHALL NOT be selectable via Layer_Panel click
6. WHEN selection changes from either source (canvas or panel), THE Selection_State SHALL update to reflect the single source of truth

### Requirement 7: 状态同步顺序

**User Story:** As a developer, I want a clear state synchronization order, so that the system maintains consistency between Layer and Canvas states.

#### Acceptance Criteria

1. WHEN any layer property changes, THE Layer_Store SHALL update first, THEN synchronize to Canvas_Object
2. THE Layer_Store SHALL NOT read state from Fabric.js Canvas_Object for business logic decisions
3. WHEN Canvas_Object events occur (selection, creation, deletion), THE Layer_Store SHALL be notified and update accordingly
4. IF Layer_Store and Canvas_Object states become inconsistent, THEN THE Layer_Store state SHALL be treated as the source of truth

### Requirement 8: 图层状态持久化

**User Story:** As a user, I want my layer visibility and lock states to persist across sessions, so that I don't lose my layer organization when I refresh the page.

#### Acceptance Criteria

1. WHEN a Layer's visibility is toggled, THE Layer_Store SHALL create a `setLayerVisibility` Op and persist it to the ops table
2. WHEN a Layer's lock state is toggled, THE Layer_Store SHALL create a `setLayerLock` Op and persist it to the ops table
3. WHEN the editor loads a document, THE Layer_Store SHALL rebuild layer state by replaying all ops in sequence order
4. THE Layer_Store SHALL derive layer list from `addText`, `addImage`, `addRect` ops during replay
5. THE Layer_Store SHALL apply `setLayerVisibility` and `setLayerLock` ops to update layer properties during replay
6. THE Layer_Store SHALL remove layers when encountering `removeLayer` ops during replay
7. WHEN ops are replayed, THE Layer_Store SHALL maintain the same layer IDs as stored in the ops payload

### Requirement 9: 图层名称持久化

**User Story:** As a user, I want my custom layer names to persist, so that my layer organization is preserved.

#### Acceptance Criteria

1. WHEN a Layer's name is changed, THE Layer_Store SHALL create a `renameLayer` Op and persist it to the ops table
2. WHEN ops are replayed, THE Layer_Store SHALL apply `renameLayer` ops to restore custom layer names
3. IF no `renameLayer` op exists for a Layer, THE Layer_Store SHALL use the default auto-generated name

## Out of Scope (Explicit Exclusions)

The following features are explicitly NOT included in this MVP:

- ❌ 图层排序（Layer reordering）
- ❌ 图层分组（Layer grouping）
- ❌ 字体/颜色配置（Font/color configuration in layer panel）
- ❌ 图片拆图层（Image layer splitting）
- ❌ AI 集成（AI integration for layers）
- ❌ 协作功能（Collaboration features）
- ❌ Undo/Redo 支持（Undo/Redo support）
