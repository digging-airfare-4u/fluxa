# Design Document: OpsPersistenceManager

## Overview

OpsPersistenceManager 是一个统一的画布操作持久化管理器，提供单一入口来创建、更新、删除画布元素并自动持久化到数据库。它封装了 Fabric.js 对象创建和 Supabase ops 表的写入逻辑。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CanvasStage                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              OpsPersistenceManager                   │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  addText()  │  │  addRect()  │  │ addImage()  │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │    │
│  │         │                │                │         │    │
│  │         ▼                ▼                ▼         │    │
│  │  ┌─────────────────────────────────────────────┐   │    │
│  │  │           createAndPersist()                │   │    │
│  │  │  1. Generate layerId                        │   │    │
│  │  │  2. Create Fabric.js object                 │   │    │
│  │  │  3. Add to canvas                           │   │    │
│  │  │  4. Call saveOp() to persist                │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │removeLayer()│  │updateLayer()│                  │    │
│  │  └─────────────┘  └─────────────┘                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│                    Fabric.js Canvas                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   saveOp()    │
                    │  (Supabase)   │
                    └───────────────┘
```

## Components and Interfaces

### OpsPersistenceManager Class

```typescript
interface AddTextParams {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
}

interface AddRectParams {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

interface AddImageParams {
  src: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
}

interface UpdateLayerParams {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  width?: number;
  height?: number;
}

class OpsPersistenceManager {
  constructor(documentId: string, canvas: fabric.Canvas);
  
  // Creation methods - return layerId
  async addText(params: AddTextParams): Promise<string>;
  async addRect(params: AddRectParams): Promise<string>;
  async addImage(params: AddImageParams): Promise<string>;
  
  // Modification methods
  async updateLayer(layerId: string, properties: UpdateLayerParams): Promise<void>;
  async removeLayer(layerId: string): Promise<void>;
  
  // Utility
  generateLayerId(): string;
  getCanvas(): fabric.Canvas;
}
```

### CanvasStageRef Extension

```typescript
interface CanvasStageRef {
  // Existing methods...
  getCanvas(): fabric.Canvas | null;
  getSynchronizer(): CanvasSynchronizer | null;
  
  // New method
  getPersistenceManager(): OpsPersistenceManager | null;
}
```

## Data Models

### Op Types (existing)

使用现有的 `ops.types.ts` 中定义的类型：
- `AddTextOp`
- `AddRectOp`
- `AddImageOp`
- `UpdateLayerOp`
- `RemoveLayerOp`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Creation operations return valid layerId

*For any* valid creation operation (addText, addRect, addImage), calling the method SHALL return a non-empty string layerId that matches the pattern `layer-{timestamp}-{random}`.

**Validates: Requirements 1.5, 2.3, 3.3, 4.3**

### Property 2: Creation operations add object to canvas

*For any* valid creation operation, after the method completes, the canvas SHALL contain an object with the returned layerId.

**Validates: Requirements 1.3, 2.1, 3.1, 4.1**

### Property 3: Creation operations persist to database

*For any* valid creation operation, the saveOp function SHALL be called with the correct op type and payload containing the layerId.

**Validates: Requirements 1.4**

### Property 4: Optional parameters are applied to created objects

*For any* creation operation with optional parameters, the created Fabric.js object SHALL have those properties set to the provided values.

**Validates: Requirements 2.2, 3.2, 4.2**

### Property 5: removeLayer removes object from canvas

*For any* existing layer, calling removeLayer SHALL result in the canvas no longer containing an object with that layerId.

**Validates: Requirements 5.1**

### Property 6: updateLayer modifies object properties

*For any* existing layer and valid properties, calling updateLayer SHALL result in the canvas object having the updated property values.

**Validates: Requirements 6.1, 6.3**

### Property 7: All modification operations persist to database

*For any* modification operation (updateLayer, removeLayer), the saveOp function SHALL be called with the correct op type.

**Validates: Requirements 5.2, 6.2**

## Integration with Layer Store

OpsPersistenceManager 创建对象后，Layer Store 的同步由 `CanvasSynchronizer` 自动处理：

```
OpsPersistenceManager.addText()
    │
    ├─► canvas.add(textObj)
    │       │
    │       └─► CanvasSynchronizer 监听 object:added
    │               │
    │               └─► LayerStore.createLayer()
    │
    └─► saveOp() ─► Supabase
```

因此 OpsPersistenceManager 不需要直接与 Layer Store 交互，只需专注于：
1. 创建 Fabric.js 对象
2. 持久化到数据库

## Error Handling

1. **Invalid parameters**: Throw `Error` with descriptive message
2. **Image loading failure**: Throw `Error` with URL and failure reason
3. **Database persistence failure**: Log error but don't throw (fire-and-forget pattern for UX)
4. **Non-existent layer**: Handle gracefully for removeLayer, warn for updateLayer

## Testing Strategy

### Unit Tests

- Test OpsPersistenceManager initialization
- Test each method with valid inputs
- Test error handling with invalid inputs
- Test edge cases (empty text, zero dimensions, etc.)

### Property-Based Tests

使用 fast-check 进行属性测试：

1. **Property 1**: 生成随机创建参数，验证返回的 layerId 格式
2. **Property 2**: 生成随机创建参数，验证 canvas 包含对应对象
3. **Property 3**: Mock saveOp，验证调用参数正确
4. **Property 4**: 生成随机可选参数，验证对象属性匹配
5. **Property 5**: 创建后删除，验证 canvas 不再包含对象
6. **Property 6**: 创建后更新，验证属性已更改
7. **Property 7**: Mock saveOp，验证修改操作触发持久化

### Integration Tests

- 测试与 CanvasStage 的集成
- 测试与 Supabase 的实际持久化（需要测试数据库）
