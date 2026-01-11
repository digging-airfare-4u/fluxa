# Requirements Document

## Introduction

本功能将 Tiptap 富文本编辑器集成到 ChatCanvas 项目中，实现文本块（Text Block）与画布块（Canvas Block）的混合编辑能力。用户可以在同一个项目中既编写长文档，又进行设计创作，并且文本内容可以与画布对象建立关联。

## Glossary

- **Document_Model**: 统一的文档数据模型，包含 blocks 数组和 links 关联
- **Text_Block**: 基于 Tiptap 的富文本编辑块
- **Canvas_Block**: 基于 Fabric.js 的画布编辑块
- **Block**: Document_Model 中的基本单元，可以是 Text_Block 或 Canvas_Block
- **Link**: 文本与画布对象之间的关联关系
- **Selection_Bus**: 统一管理跨 Block 选择状态的事件总线
- **Focus_Manager**: 管理编辑焦点在不同 Block 间切换的组件
- **Text_Op**: 针对 Text_Block 的操作类型
- **Ops_Engine**: 统一处理所有 Op 的核心引擎

## Requirements

### Requirement 1: Document Model 扩展

**User Story:** As a developer, I want a unified document model that supports both text and canvas blocks, so that I can manage mixed content in a single data structure.

#### Acceptance Criteria

1. THE Document_Model SHALL define a blocks array containing Block objects with id, type, and content fields
2. WHEN a Block has type 'text', THE Document_Model SHALL store Tiptap JSON content in the content field
3. WHEN a Block has type 'canvas', THE Document_Model SHALL store Fabric JSON content in the content field
4. THE Document_Model SHALL define a links array for text-canvas associations
5. WHEN serializing the Document_Model, THE System SHALL produce valid JSON that can be stored in Supabase

### Requirement 2: Text Block 组件

**User Story:** As a user, I want to edit rich text content in a dedicated text block, so that I can write long-form content alongside my designs.

#### Acceptance Criteria

1. WHEN a Text_Block is rendered, THE System SHALL display a Tiptap editor with the block's content
2. WHEN a user types in the Text_Block, THE System SHALL update the Tiptap JSON content in real-time
3. THE Text_Block SHALL support basic formatting: bold, italic, underline, strikethrough
4. THE Text_Block SHALL support headings (H1, H2, H3), paragraphs, and lists (ordered, unordered)
5. THE Text_Block SHALL support inline code and code blocks
6. WHEN the Text_Block loses focus, THE System SHALL persist changes to the Document_Model

### Requirement 3: Text Ops 类型定义

**User Story:** As a developer, I want text operations defined as discrete ops, so that all changes are trackable and replayable.

#### Acceptance Criteria

1. THE System SHALL define an 'addTextBlock' op type with payload containing id, position, and optional initial content
2. THE System SHALL define an 'updateTextBlock' op type with payload containing id and Tiptap JSON delta
3. THE System SHALL define a 'removeTextBlock' op type with payload containing id
4. THE System SHALL define a 'moveBlock' op type with payload containing id and new position index
5. WHEN parsing Text_Op JSON, THE System SHALL validate against the defined schema
6. FOR ALL valid Text_Op objects, serializing then deserializing SHALL produce an equivalent object

### Requirement 4: Ops Engine 扩展

**User Story:** As a developer, I want the existing Ops Engine to handle text operations, so that I can maintain a single execution pipeline.

#### Acceptance Criteria

1. WHEN the Ops_Engine receives an 'addTextBlock' op, THE System SHALL create a new Text_Block at the specified position
2. WHEN the Ops_Engine receives an 'updateTextBlock' op, THE System SHALL apply the Tiptap delta to the target block
3. WHEN the Ops_Engine receives a 'removeTextBlock' op, THE System SHALL remove the block from the Document_Model
4. WHEN the Ops_Engine receives a 'moveBlock' op, THE System SHALL reorder blocks in the Document_Model
5. THE Ops_Engine SHALL maintain idempotency for all text operations

### Requirement 5: Editor Layout 集成

**User Story:** As a user, I want to see text blocks and canvas blocks in a unified editor view, so that I can work on both content types seamlessly.

#### Acceptance Criteria

1. THE EditorLayout SHALL render blocks in their Document_Model order
2. WHEN a user clicks on a Text_Block, THE Focus_Manager SHALL set focus to that block's Tiptap editor
3. WHEN a user clicks on a Canvas_Block, THE Focus_Manager SHALL set focus to the Fabric canvas
4. THE System SHALL provide visual indicators showing which block currently has focus
5. WHEN pressing Tab at the end of a block, THE System SHALL move focus to the next block

### Requirement 6: Block 添加与管理

**User Story:** As a user, I want to add, remove, and reorder blocks, so that I can organize my document structure.

#### Acceptance Criteria

1. WHEN a user clicks the add block button, THE System SHALL display a menu with block type options (text, canvas)
2. WHEN a user selects a block type, THE System SHALL insert a new block below the current block
3. WHEN a user drags a block handle, THE System SHALL allow reordering blocks via drag-and-drop
4. WHEN a user clicks the delete button on a block, THE System SHALL remove that block after confirmation
5. IF a block is the only block in the document, THEN THE System SHALL prevent deletion

### Requirement 7: Selection Bus

**User Story:** As a developer, I want a unified selection state across all blocks, so that copy/paste and other operations work consistently.

#### Acceptance Criteria

1. THE Selection_Bus SHALL maintain a single source of truth for current selection
2. WHEN selection changes in any block, THE Selection_Bus SHALL emit a selection change event
3. WHEN a Text_Block has text selected, THE Selection_Bus SHALL store the text range and block id
4. WHEN a Canvas_Block has objects selected, THE Selection_Bus SHALL store the object ids and block id
5. WHEN focus moves to a different block, THE Selection_Bus SHALL clear the previous block's selection

### Requirement 8: 数据持久化

**User Story:** As a user, I want my document changes to be saved automatically, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN the Document_Model changes, THE System SHALL debounce and persist to Supabase within 2 seconds
2. THE System SHALL store the complete Document_Model JSON in the documents table
3. THE System SHALL store individual ops in the ops table for replay capability
4. WHEN loading a document, THE System SHALL reconstruct the Document_Model from stored JSON
5. IF persistence fails, THEN THE System SHALL display an error notification and retry

### Requirement 9: AI 集成

**User Story:** As a user, I want AI to generate both text content and canvas designs, so that I can use natural language for all content creation.

#### Acceptance Criteria

1. WHEN a user requests text content via chat, THE AI SHALL generate 'addTextBlock' or 'updateTextBlock' ops
2. WHEN a user requests mixed content, THE AI SHALL generate a sequence of text and canvas ops
3. THE AI prompt schema SHALL be extended to include text block operations
4. WHEN generating text content, THE AI SHALL produce valid Tiptap JSON format
