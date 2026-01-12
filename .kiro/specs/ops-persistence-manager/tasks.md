# Implementation Plan: OpsPersistenceManager

## Overview

创建统一的画布操作持久化管理器，重构现有代码使用该管理器，并添加拖拽聊天内容到画布的功能。

## Tasks

- [x] 1. 创建 OpsPersistenceManager 类
  - [x] 1.1 创建 `src/lib/canvas/opsPersistenceManager.ts` 文件
    - 定义 `AddTextParams`, `AddRectParams`, `AddImageParams`, `UpdateLayerParams` 接口
    - 实现 `OpsPersistenceManager` 类构造函数
    - 实现 `generateLayerId()` 方法
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 实现 addText 方法
    - 创建 Fabric.js IText 对象
    - 设置 id 属性
    - 添加到 canvas
    - 调用 saveOp 持久化
    - 返回 layerId
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 实现 addRect 方法
    - 创建 Fabric.js Rect 对象
    - 设置 id 属性
    - 添加到 canvas
    - 调用 saveOp 持久化
    - 返回 layerId
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.4 实现 addImage 方法
    - 异步加载图片
    - 创建 Fabric.js Image 对象
    - 设置 id 属性和缩放
    - 添加到 canvas
    - 调用 saveOp 持久化
    - 返回 layerId
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.5 实现 removeLayer 方法
    - 查找 canvas 中的对象
    - 从 canvas 移除
    - 调用 saveOp 持久化 removeLayer op
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.6 实现 updateLayer 方法
    - 查找 canvas 中的对象
    - 更新属性
    - 调用 saveOp 持久化 updateLayer op
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Checkpoint - 验证 OpsPersistenceManager 基础功能
  - 确保所有方法实现完成
  - 运行类型检查

- [x] 3. 集成到 CanvasStage
  - [x] 3.1 在 CanvasStage 中创建 OpsPersistenceManager 实例
    - 在 canvas 初始化后创建
    - 存储在 ref 中
    - _Requirements: 7.3_

  - [x] 3.2 扩展 CanvasStageRef 接口
    - 添加 `getPersistenceManager()` 方法
    - 在 useImperativeHandle 中暴露
    - _Requirements: 7.1, 7.2_

- [x] 4. 重构现有代码使用 OpsPersistenceManager
  - [x] 4.1 重构矩形工具
    - 修改 rectangle tool 的 handleMouseUp
    - 使用 `persistenceManager.addRect()` 替代直接 saveOp
    - _Requirements: 8.1_

  - [x] 4.2 重构文字工具
    - 修改 text tool 的 handleMouseUp
    - 使用 `persistenceManager.addText()` 替代直接 saveOp
    - _Requirements: 8.2_

  - [x] 4.3 重构删除功能
    - 修改 deleteSelected 函数
    - 使用 `persistenceManager.removeLayer()` 替代直接 saveOp
    - _Requirements: 8.3_

  - [x] 4.4 重构图层修改
    - 修改 EditorLayout 中的 onLayerModified 处理
    - 使用 `persistenceManager.updateLayer()` 替代直接 saveOp
    - _Requirements: 8.4_

- [x] 5. Checkpoint - 验证重构后功能正常
  - 测试矩形工具创建和持久化
  - 测试文字工具创建和持久化
  - 测试删除功能和持久化
  - 测试拖拽修改和持久化
  - 刷新页面验证数据恢复

- [ ]* 6. 编写单元测试
  - [ ]* 6.1 测试 OpsPersistenceManager 初始化
    - 测试构造函数参数
    - 测试 generateLayerId 格式
    - _Requirements: 1.1, 1.2_

  - [ ]* 6.2 测试创建方法
    - 测试 addText 返回 layerId
    - 测试 addRect 返回 layerId
    - 测试 addImage 返回 layerId
    - _Requirements: 2.1, 3.1, 4.1_

- [ ]* 7. 编写属性测试
  - [ ]* 7.1 Property 1: 创建操作返回有效 layerId
    - **Property 1: Creation operations return valid layerId**
    - **Validates: Requirements 1.5, 2.3, 3.3, 4.3**

  - [ ]* 7.2 Property 2: 创建操作添加对象到 canvas
    - **Property 2: Creation operations add object to canvas**
    - **Validates: Requirements 1.3, 2.1, 3.1, 4.1**

- [x] 8. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证构建成功
  - 如有问题，询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个任务引用具体需求以确保可追溯性
- Checkpoint 任务用于增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
