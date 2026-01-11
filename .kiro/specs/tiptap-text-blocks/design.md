# Design Document: Tiptap Text Blocks Integration

## Overview

本设计将 Tiptap 富文本编辑器集成到 ChatCanvas 的 ops-driven 架构中，实现文本块与画布块的混合编辑。核心思路是：

1. **扩展 Document Model** - 引入 blocks 数组和 links 关联
2. **新增 Text Ops** - 定义文本操作类型，复用现有 Ops Engine
3. **Block-based UI** - 编辑器按 block 顺序渲染，支持焦点切换
4. **渐进式集成** - 不影响现有 Canvas 功能

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      EditorLayout                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    BlockRenderer                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     ││
│  │  │ TextBlock   │  │ CanvasBlock │  │ TextBlock   │     ││
│  │  │ (Tiptap)    │  │ (Fabric.js) │  │ (Tiptap)    │     ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     ││
│  └─────────┼────────────────┼────────────────┼─────────────┘│
│            │                │                │               │
│            ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Selection Bus                          ││
│  │              (unified selection state)                   ││
│  └─────────────────────────┬───────────────────────────────┘│
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Ops Engine                            ││
│  │  - Canvas Ops (existing)                                 ││
│  │  - Text Ops (new)                                        ││
│  │  - Block Ops (new)                                       ││
│  └─────────────────────────┬───────────────────────────────┘│
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Document Model                            │
│  {                                                           │
│    blocks: [                                                 │
│      { id, type: 'text', content: TiptapJSON },             │
│      { id, type: 'canvas', content: FabricJSON }            │
│    ],                                                        │
│    links: [...]                                              │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Document Model Types

```typescript
// src/lib/document/types.ts

export type BlockType = 'text' | 'canvas';

export interface BaseBlock {
  id: string;
  type: BlockType;
  createdAt: string;
  updatedAt: string;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  content: TiptapContent; // Tiptap JSON format
}

export interface CanvasBlock extends BaseBlock {
  type: 'canvas';
  content: FabricContent; // Fabric JSON format
  width: number;
  height: number;
}

export type Block = TextBlock | CanvasBlock;

export interface DocumentLink {
  id: string;
  sourceBlockId: string;
  sourceAnchor: TextAnchor | CanvasAnchor;
  targetBlockId: string;
  targetAnchor: TextAnchor | CanvasAnchor;
}

export interface TextAnchor {
  type: 'text';
  from: number; // character position
  to: number;
}

export interface CanvasAnchor {
  type: 'canvas';
  objectId: string;
}

export interface DocumentModel {
  id: string;
  projectId: string;
  blocks: Block[];
  links: DocumentLink[];
  version: number;
  updatedAt: string;
}

export interface TiptapContent {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface FabricContent {
  version: string;
  objects: FabricObject[];
  background?: string;
}
```

### 2. Text Ops Types

```typescript
// src/lib/document/textOps.types.ts

export type TextOpType = 
  | 'addTextBlock'
  | 'updateTextBlock'
  | 'removeTextBlock'
  | 'moveBlock';

export interface AddTextBlockOp {
  type: 'addTextBlock';
  payload: {
    id: string;
    position: number; // index in blocks array
    content?: TiptapContent;
  };
}

export interface UpdateTextBlockOp {
  type: 'updateTextBlock';
  payload: {
    id: string;
    content: TiptapContent;
  };
}

export interface RemoveTextBlockOp {
  type: 'removeTextBlock';
  payload: {
    id: string;
  };
}

export interface MoveBlockOp {
  type: 'moveBlock';
  payload: {
    id: string;
    fromPosition: number;
    toPosition: number;
  };
}

export type TextOp = 
  | AddTextBlockOp 
  | UpdateTextBlockOp 
  | RemoveTextBlockOp 
  | MoveBlockOp;
```

### 3. TextBlock Component

```typescript
// src/components/blocks/TextBlock.tsx

interface TextBlockProps {
  block: TextBlock;
  isActive: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onContentChange: (content: TiptapContent) => void;
}

// Uses @tiptap/react with extensions:
// - StarterKit (basic formatting)
// - Placeholder
// - Typography
// - CodeBlockLowlight (syntax highlighting)
```

### 4. BlockRenderer Component

```typescript
// src/components/blocks/BlockRenderer.tsx

interface BlockRendererProps {
  blocks: Block[];
  activeBlockId: string | null;
  onBlockFocus: (blockId: string) => void;
  onBlockChange: (blockId: string, content: unknown) => void;
  onBlockAdd: (type: BlockType, afterBlockId?: string) => void;
  onBlockRemove: (blockId: string) => void;
  onBlockMove: (blockId: string, newPosition: number) => void;
}

// Renders blocks in order, handles drag-and-drop reordering
```

### 5. Selection Bus

```typescript
// src/lib/selection/selectionBus.ts

export interface TextSelection {
  type: 'text';
  blockId: string;
  from: number;
  to: number;
  text: string;
}

export interface CanvasSelection {
  type: 'canvas';
  blockId: string;
  objectIds: string[];
}

export type Selection = TextSelection | CanvasSelection | null;

export interface SelectionBus {
  getSelection(): Selection;
  setSelection(selection: Selection): void;
  clearSelection(): void;
  subscribe(callback: (selection: Selection) => void): () => void;
}

// Implementation using Zustand store
```

### 6. Extended Ops Engine

```typescript
// src/lib/document/documentOpsExecutor.ts

export class DocumentOpsExecutor {
  private document: DocumentModel;
  private canvasExecutors: Map<string, OpsExecutor>; // existing canvas executor per block
  
  async execute(ops: (Op | TextOp)[]): Promise<void>;
  
  private handleAddTextBlock(op: AddTextBlockOp): void;
  private handleUpdateTextBlock(op: UpdateTextBlockOp): void;
  private handleRemoveTextBlock(op: RemoveTextBlockOp): void;
  private handleMoveBlock(op: MoveBlockOp): void;
  
  // Delegates canvas ops to existing OpsExecutor
  private handleCanvasOp(op: Op, blockId: string): Promise<void>;
}
```

## Data Models

### Database Schema Extension

```sql
-- Extend documents table to store DocumentModel
ALTER TABLE documents ADD COLUMN IF NOT EXISTS 
  doc_model JSONB DEFAULT '{"blocks": [], "links": [], "version": 1}';

-- Add index for efficient block queries
CREATE INDEX IF NOT EXISTS idx_documents_doc_model_blocks 
  ON documents USING GIN ((doc_model -> 'blocks'));

-- Extend ops table to support text ops
ALTER TABLE ops ADD COLUMN IF NOT EXISTS 
  block_id UUID REFERENCES documents(id);
```

### Migration Strategy

1. 现有 documents 保持 canvas-only 模式
2. 新建 documents 使用 DocumentModel
3. 提供迁移脚本将旧文档转换为单 canvas block



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document Model Structure Validity

*For any* valid DocumentModel, the blocks array SHALL exist and each block SHALL have id (string), type ('text' | 'canvas'), and content fields.

**Validates: Requirements 1.1, 1.4**

### Property 2: Block Content Type Consistency

*For any* Block in a DocumentModel, if type is 'text' then content SHALL be valid TiptapContent (with type: 'doc' and content array), and if type is 'canvas' then content SHALL be valid FabricContent (with version and objects array).

**Validates: Requirements 1.2, 1.3**

### Property 3: Document Model Serialization Round-Trip

*For any* valid DocumentModel, serializing to JSON and deserializing back SHALL produce an equivalent DocumentModel with identical blocks, links, and metadata.

**Validates: Requirements 1.5**

### Property 4: TextOp Validation Completeness

*For any* TextOp object, the validator SHALL accept it if and only if it has a valid type ('addTextBlock' | 'updateTextBlock' | 'removeTextBlock' | 'moveBlock') and the payload contains all required fields for that type.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: TextOp Serialization Round-Trip

*For any* valid TextOp object, serializing to JSON and deserializing back SHALL produce an equivalent TextOp with identical type and payload.

**Validates: Requirements 3.6**

### Property 6: AddTextBlock Execution Correctness

*For any* DocumentModel with n blocks and any valid addTextBlock op with position p (0 ≤ p ≤ n), executing the op SHALL result in a DocumentModel with n+1 blocks where the new block is at index p.

**Validates: Requirements 4.1**

### Property 7: UpdateTextBlock Execution Correctness

*For any* DocumentModel containing a TextBlock with id X and any valid updateTextBlock op targeting X, executing the op SHALL update only that block's content while preserving all other blocks unchanged.

**Validates: Requirements 4.2**

### Property 8: RemoveTextBlock Execution Correctness

*For any* DocumentModel with n blocks (n > 1) containing a block with id X and any valid removeTextBlock op targeting X, executing the op SHALL result in a DocumentModel with n-1 blocks where block X no longer exists.

**Validates: Requirements 4.3**

### Property 9: MoveBlock Execution Correctness

*For any* DocumentModel with n blocks and any valid moveBlock op moving block at position p to position q, executing the op SHALL result in a DocumentModel with the same n blocks but with the moved block now at index q.

**Validates: Requirements 4.4**

### Property 10: Ops Idempotency

*For any* DocumentModel and any valid TextOp with a unique sequence number, executing the op twice SHALL produce the same result as executing it once.

**Validates: Requirements 4.5**

### Property 11: Single Block Deletion Prevention

*For any* DocumentModel with exactly 1 block, attempting to execute a removeTextBlock op SHALL fail and leave the DocumentModel unchanged.

**Validates: Requirements 6.5**

### Property 12: Selection Bus State Consistency

*For any* sequence of setSelection calls on the SelectionBus, getSelection SHALL always return the most recently set selection, and all subscribers SHALL be notified of each change.

**Validates: Requirements 7.1, 7.2**

### Property 13: Selection Structure by Type

*For any* TextSelection, it SHALL contain blockId, from, to, and text fields. *For any* CanvasSelection, it SHALL contain blockId and objectIds array.

**Validates: Requirements 7.3, 7.4**

### Property 14: Selection Clearing on Focus Change

*For any* SelectionBus with a selection in block A, when setSelection is called with a selection in block B (B ≠ A), the previous selection SHALL be cleared and only the new selection SHALL be active.

**Validates: Requirements 7.5**

### Property 15: Document Persistence Round-Trip

*For any* valid DocumentModel, storing to database and loading back SHALL produce an equivalent DocumentModel.

**Validates: Requirements 8.4**

## Error Handling

### Document Model Errors

| Error | Condition | Handling |
|-------|-----------|----------|
| `InvalidBlockType` | Block type not 'text' or 'canvas' | Reject op, log error |
| `BlockNotFound` | Op targets non-existent block id | Reject op, return error |
| `InvalidPosition` | Position out of bounds | Clamp to valid range |
| `LastBlockDeletion` | Attempt to delete only block | Reject op, show warning |

### Ops Execution Errors

| Error | Condition | Handling |
|-------|-----------|----------|
| `InvalidOpPayload` | Missing required fields | Reject op, log validation errors |
| `DuplicateBlockId` | AddTextBlock with existing id | Generate new id, log warning |
| `ContentParseError` | Invalid Tiptap/Fabric JSON | Reject op, show error notification |

### Persistence Errors

| Error | Condition | Handling |
|-------|-----------|----------|
| `SaveFailed` | Supabase write error | Retry 3 times with exponential backoff |
| `LoadFailed` | Supabase read error | Show error, offer retry |
| `VersionConflict` | Concurrent edit detected | Merge or prompt user |

## Testing Strategy

### Unit Tests

- Document Model type validation
- TextOp validation functions
- Selection Bus state management
- Block CRUD operations

### Property-Based Tests

Using **fast-check** (already in project):

1. **Document Model round-trip** - Generate random DocumentModels, serialize/deserialize
2. **TextOp validation** - Generate random ops, verify validation correctness
3. **Ops execution** - Generate random DocumentModels and ops, verify state transitions
4. **Selection Bus** - Generate random selection sequences, verify consistency

Each property test runs minimum 100 iterations.

### Integration Tests

- Tiptap editor rendering with various content
- Ops execution with real Fabric.js canvas
- Supabase persistence round-trip

### Test Configuration

```typescript
// vitest.config.ts - already configured
// Tests in tests/document/ directory
// Property tests tagged with feature and property number
// Example: /** Feature: tiptap-text-blocks, Property 3: Document Model Serialization Round-Trip */
```
