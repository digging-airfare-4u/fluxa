# Implementation Plan: Layer System

## Overview

本实现计划将图层系统分为 5 个主要阶段：
1. 基础类型和 Store 定义
2. Canvas Synchronizer 实现
3. UI 组件开发
4. 集成到 EditorLayout
5. 测试和验证

## Tasks

- [x] 1. 定义 Layer 类型和 Store
  - [x] 1.1 创建 Layer 类型定义文件
    - 创建 `src/lib/canvas/layer.types.ts`
    - 定义 `LayerType`、`Layer` 接口
    - 定义 `LayerState`、`LayerActions` 接口
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 实现 Layer Store
    - 创建 `src/lib/store/useLayerStore.ts`
    - 实现 `createLayer`、`removeLayer` 方法
    - 实现 `toggleVisibility`、`toggleLock` 方法
    - 实现 `setSelectedLayer`、`togglePanel` 方法
    - 实现 `renameLayer` 方法（更新图层名称）
    - 实现 `getLayerByCanvasObjectId`、`getLayersArray` 方法
    - 导出 selector hooks
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 9.1_

  - [ ]* 1.3 编写 Layer Store 单元测试
    - 测试 createLayer 生成正确的 Layer 对象
    - 测试 toggleVisibility/toggleLock 正确更新状态
    - 测试 removeLayer 正确删除 Layer
    - _Requirements: 1.1, 1.5_

  - [ ]* 1.4 编写 Layer 数据完整性属性测试
    - **Property 1: Layer Data Integrity**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 1.5 编写 Layer 默认值属性测试
    - **Property 2: Layer Default Values**
    - **Validates: Requirements 1.5**

- [x] 2. 实现 Canvas Synchronizer
  - [x] 2.1 创建 Canvas Synchronizer 类
    - 创建 `src/lib/canvas/canvasSynchronizer.ts`
    - 实现 `initialize`、`dispose` 方法
    - 实现 `syncVisibility`、`syncLockState`、`syncSelection` 方法
    - 实现 Canvas 事件监听 (object:added, object:removed, selection:*)
    - _Requirements: 7.1, 7.3_

  - [x] 2.2 实现 Layer → Canvas 同步逻辑
    - 实现可见性同步：设置 `visible` 和 `selectable` 属性
    - 实现锁定同步：设置 `selectable` 和 `evented` 属性
    - 实现选中同步：调用 `canvas.setActiveObject` 或 `discardActiveObject`
    - _Requirements: 4.2, 4.3, 4.5, 5.2, 5.3, 5.5_

  - [x] 2.3 实现 Canvas → Layer 同步逻辑
    - 监听 `object:added` 事件，自动创建 Layer
    - 监听 `object:removed` 事件，自动删除 Layer
    - 监听 `selection:created/updated/cleared` 事件，更新选中状态
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.3_

  - [ ]* 2.4 编写 Canvas Synchronizer 单元测试
    - 测试 syncVisibility 正确设置 Canvas Object 属性
    - 测试 syncLockState 正确设置 Canvas Object 属性
    - 测试事件监听正确触发 Layer Store 更新
    - _Requirements: 4.2, 5.2, 7.3_

  - [ ]* 2.5 编写可见性同步属性测试
    - **Property 6: Visibility Canvas Sync**
    - **Validates: Requirements 4.2, 4.3, 4.5**

  - [ ]* 2.6 编写锁定同步属性测试
    - **Property 8: Lock Canvas Sync**
    - **Validates: Requirements 5.2, 5.3, 5.5**

- [x] 3. Checkpoint - 确保 Store 和 Synchronizer 测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

- [x] 4. 开发 Layer UI 组件
  - [x] 4.1 创建 LayerItem 组件
    - 创建 `src/components/layer/LayerItem.tsx`
    - 显示图层名称和类型图标
    - 实现可见性切换按钮 (Eye/EyeOff 图标)
    - 实现锁定切换按钮 (Lock/Unlock 图标)
    - 实现双击图层名称进入编辑模式
    - 编辑完成后调用 `renameLayer` 方法
    - 支持选中高亮样式
    - _Requirements: 3.2, 3.3, 9.1_

  - [x] 4.2 创建 LayerPanel 组件
    - 创建 `src/components/layer/LayerPanel.tsx`
    - 使用 Layer Store 获取图层列表
    - 渲染 LayerItem 列表
    - 处理图层点击选中事件
    - 支持面板显示/隐藏动画
    - _Requirements: 3.1, 3.4, 3.5_

  - [x] 4.3 创建 LayerPanelToggle 组件
    - 创建 `src/components/layer/LayerPanelToggle.tsx`
    - 定位在画布左下角
    - 显示 Layers 图标
    - 点击切换面板显示状态
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 4.4 创建 layer 组件导出文件
    - 创建 `src/components/layer/index.ts`
    - 导出所有 layer 组件
    - _Requirements: N/A_

  - [ ]* 4.5 编写 LayerPanel 组件测试
    - 测试正确渲染所有图层
    - 测试点击图层触发选中
    - 测试可见性/锁定切换
    - _Requirements: 3.1, 3.2, 3.7_

- [x] 5. 集成到 EditorLayout
  - [x] 5.1 修改 CanvasStage 集成 Synchronizer
    - 在 CanvasStage 中初始化 CanvasSynchronizer
    - 移除现有的 extractLayers 逻辑（由 Layer Store 接管）
    - 确保工具创建的对象触发 Layer 创建
    - _Requirements: 2.1, 2.2, 2.3, 7.1_

  - [x] 5.2 修改 EditorLayout 添加 Layer 组件
    - 导入 LayerPanel 和 LayerPanelToggle
    - 在画布区域添加 LayerPanelToggle（左下角）
    - 添加 LayerPanel（可收起的侧边面板）
    - _Requirements: 3.5, 3.6_

  - [x] 5.3 实现选中联动逻辑
    - 画布选中 → 图层高亮
    - 图层点击 → 画布选中
    - 隐藏/锁定图层不可选中
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [x] 5.4 实现隐藏/锁定时自动取消选中
    - 隐藏选中图层时自动取消选中
    - 锁定选中图层时自动取消选中
    - _Requirements: 4.6, 5.6_

  - [ ]* 5.5 编写选中联动属性测试
    - **Property 10: Bidirectional Selection Sync**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**

  - [ ]* 5.6 编写选中阻止属性测试
    - **Property 11: Selection Prevention for Hidden/Locked Layers**
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 5.7 编写选中清理属性测试
    - **Property 9: Selection Cleanup on State Change**
    - **Validates: Requirements 4.6, 5.6**

- [x] 6. Checkpoint - 确保集成测试通过
  - 运行所有测试，确保通过
  - 手动测试完整流程
  - 如有问题，询问用户

- [x] 7. 完善和优化
  - [x] 7.1 添加 Toggle Round-Trip 属性测试
    - **Property 5: Visibility Toggle Round-Trip**
    - **Property 7: Lock Toggle Round-Trip**
    - **Property 13: Panel Toggle Round-Trip**
    - **Validates: Requirements 4.1, 4.4, 5.1, 5.4, 3.7**

  - [x] 7.2 添加 Layer Store 源真相属性测试
    - **Property 12: Layer Store as Source of Truth**
    - **Validates: Requirements 7.1, 7.3, 7.4**

  - [x] 7.3 更新 Store 导出
    - 更新 `src/lib/store/index.ts` 导出 Layer Store
    - _Requirements: N/A_

- [ ] 8. 实现图层持久化
  - [x] 8.1 扩展 Op 类型定义
    - 在 `src/lib/canvas/ops.types.ts` 添加 `addRect`、`setLayerVisibility`、`setLayerLock`、`renameLayer` Op 类型
    - 添加类型守卫函数
    - 更新 `validateOp` 和 `validateOpPayload` 函数
    - _Requirements: 8.1, 8.2, 9.1_

  - [x] 8.2 扩展 OpsExecutor 支持 addRect
    - 在 `src/lib/canvas/opsExecutor.ts` 添加 `handleAddRect` 方法
    - 创建 Fabric.js Rect 对象并添加到画布
    - _Requirements: 8.4_

  - [x] 8.3 实现手动创建元素的持久化
    - 修改 `CanvasStage.tsx` 中矩形创建逻辑
    - 矩形创建完成后生成 `addRect` op 并持久化到 ops 表
    - 文字创建完成后生成 `addText` op 并持久化到 ops 表
    - _Requirements: 2.6, 2.7_

  - [x] 8.4 实现 Ops 重放图层推导
    - 创建 `src/lib/canvas/layerDerivation.ts`
    - 实现 `deriveLayersFromOps` 函数
    - 从 addRect、addText、addImage ops 推导图层列表
    - 应用 setLayerVisibility、setLayerLock、renameLayer ops
    - 处理 removeLayer ops
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 8.5 集成持久化到 Layer Store
    - 添加 `persistVisibility`、`persistLock`、`persistName` 方法
    - 添加 `initializeFromOps` 方法
    - 在 toggleVisibility/toggleLock 时自动持久化
    - _Requirements: 8.1, 8.2, 9.1_

  - [x] 8.6 修改编辑器加载流程
    - 在文档加载时调用 `initializeFromOps`
    - 确保图层状态在 ops 重放后正确恢复
    - _Requirements: 8.3, 8.7_

  - [ ]* 8.7 编写 Ops 重放属性测试
    - **Property 14: Ops Replay Layer Reconstruction**
    - **Property 15: Visibility Persistence Round-Trip**
    - **Property 16: Lock Persistence Round-Trip**
    - **Property 17: Layer Name Persistence Round-Trip**
    - **Property 18: RemoveLayer Op Consistency**
    - **Validates: Requirements 8.1-8.7, 9.1, 9.2**

- [x] 9. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有验收标准
  - 如有问题，询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 每个任务引用具体需求以确保可追溯性
- Checkpoint 任务用于增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
