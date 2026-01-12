# Requirements Document

## Introduction

统一的 Canvas 操作持久化管理器，提供单一入口来创建、更新、删除画布元素并自动持久化到数据库。解决当前 `saveOp` 调用分散在多个组件中的问题，简化新功能（如拖拽文本到画布）的实现。

## Glossary

- **OpsPersistenceManager**: 统一的操作持久化管理器类
- **Op**: Canvas 操作对象（addText, addRect, addImage, updateLayer, removeLayer 等）
- **Layer**: 画布上的图层元素
- **Fabric.js**: 底层 Canvas 渲染库

## Requirements

### Requirement 1: 创建 OpsPersistenceManager 类

**User Story:** As a developer, I want a unified persistence manager, so that I can easily add canvas elements with automatic database persistence.

#### Acceptance Criteria

1. THE OpsPersistenceManager SHALL be initialized with documentId and canvas reference
2. THE OpsPersistenceManager SHALL provide methods for all canvas operations (addText, addRect, addImage, updateLayer, removeLayer)
3. WHEN an operation method is called, THE OpsPersistenceManager SHALL create the Fabric.js object on canvas
4. WHEN an operation method is called, THE OpsPersistenceManager SHALL persist the op to database via saveOp
5. THE OpsPersistenceManager SHALL return the generated layerId after successful creation

### Requirement 2: addText 方法

**User Story:** As a user, I want to add text to the canvas, so that I can create text elements that persist across sessions.

#### Acceptance Criteria

1. WHEN addText is called with text content and position, THE OpsPersistenceManager SHALL create an IText object at the specified position
2. THE addText method SHALL accept optional parameters: fontSize, fontFamily, fill, fontWeight, textAlign
3. WHEN addText succeeds, THE OpsPersistenceManager SHALL return the generated layerId
4. IF addText fails, THEN THE OpsPersistenceManager SHALL throw an error with descriptive message

### Requirement 3: addRect 方法

**User Story:** As a user, I want to add rectangles to the canvas, so that I can create shape elements that persist.

#### Acceptance Criteria

1. WHEN addRect is called with position and dimensions, THE OpsPersistenceManager SHALL create a Rect object
2. THE addRect method SHALL accept optional parameters: fill, stroke, strokeWidth
3. WHEN addRect succeeds, THE OpsPersistenceManager SHALL return the generated layerId

### Requirement 4: addImage 方法

**User Story:** As a user, I want to add images to the canvas, so that I can include images that persist.

#### Acceptance Criteria

1. WHEN addImage is called with src URL and position, THE OpsPersistenceManager SHALL load and create an Image object
2. THE addImage method SHALL accept optional parameters: width, height, scaleX, scaleY
3. WHEN addImage succeeds, THE OpsPersistenceManager SHALL return the generated layerId
4. IF image loading fails, THEN THE OpsPersistenceManager SHALL throw an error

### Requirement 5: removeLayer 方法

**User Story:** As a user, I want to remove elements from the canvas, so that deletions persist across sessions.

#### Acceptance Criteria

1. WHEN removeLayer is called with layerId, THE OpsPersistenceManager SHALL remove the object from canvas
2. WHEN removeLayer is called, THE OpsPersistenceManager SHALL persist the removeLayer op to database
3. IF layer does not exist, THEN THE OpsPersistenceManager SHALL handle gracefully without error

### Requirement 6: updateLayer 方法

**User Story:** As a user, I want to update element properties, so that changes persist across sessions.

#### Acceptance Criteria

1. WHEN updateLayer is called with layerId and properties, THE OpsPersistenceManager SHALL update the canvas object
2. WHEN updateLayer is called, THE OpsPersistenceManager SHALL persist the updateLayer op to database
3. THE updateLayer method SHALL support properties: left, top, scaleX, scaleY, angle, width, height

### Requirement 7: 通过 CanvasStageRef 暴露

**User Story:** As a developer, I want to access the persistence manager via CanvasStageRef, so that I can use it from parent components.

#### Acceptance Criteria

1. THE CanvasStageRef SHALL expose a getPersistenceManager method
2. WHEN getPersistenceManager is called, THE CanvasStage SHALL return the OpsPersistenceManager instance
3. THE OpsPersistenceManager SHALL be available after canvas initialization

### Requirement 8: 重构现有代码

**User Story:** As a developer, I want existing code to use the unified manager, so that persistence logic is consistent.

#### Acceptance Criteria

1. WHEN rectangle tool creates a shape, THE CanvasStage SHALL use OpsPersistenceManager.addRect
2. WHEN text tool creates text, THE CanvasStage SHALL use OpsPersistenceManager.addText
3. WHEN delete is triggered, THE CanvasStage SHALL use OpsPersistenceManager.removeLayer
4. WHEN layer is modified, THE EditorLayout SHALL use OpsPersistenceManager.updateLayer
