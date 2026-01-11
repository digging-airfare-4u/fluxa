# Implementation Plan: Tiptap Text Blocks Integration

## Overview

渐进式集成 Tiptap 富文本编辑到现有 ChatCanvas 项目，保持现有 Canvas 功能不受影响。

## Tasks

- [ ] 1. 安装依赖和项目配置
  - 安装 @tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder 等
  - 配置 Tailwind 支持 Tiptap 样式
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 2. Document Model 类型定义
  - [ ] 2.1 创建 `src/lib/document/types.ts` 定义 Block, DocumentModel, Link 类型
    - 定义 BaseBlock, TextBlock, CanvasBlock 接口
    - 定义 TiptapContent, FabricContent 类型
    - 定义 DocumentModel 接口
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 2.2 编写 Document Model 结构验证的 property test
    - **Property 1: Document Model Structure Validity**
    - **Property 2: Block Content Type Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  - [ ]* 2.3 编写 Document Model 序列化往返的 property test
    - **Property 3: Document Model Serialization Round-Trip**
    - **Validates: Requirements 1.5**

- [ ] 3. TextOps 类型和验证
  - [ ] 3.1 创建 `src/lib/document/textOps.types.ts` 定义 TextOp 类型
    - 定义 AddTextBlockOp, UpdateTextBlockOp, RemoveTextBlockOp, MoveBlockOp
    - 实现 validateTextOp 函数
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 3.2 编写 TextOp 验证的 property test
    - **Property 4: TextOp Validation Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  - [ ]* 3.3 编写 TextOp 序列化往返的 property test
    - **Property 5: TextOp Serialization Round-Trip**
    - **Validates: Requirements 3.6**

- [ ] 4. Checkpoint - 确保类型定义和验证测试通过
  - 运行 `pnpm test` 确保所有测试通过
  - 如有问题请询问用户

- [ ] 5. Document Ops Executor 实现
  - [ ] 5.1 创建 `src/lib/document/documentOpsExecutor.ts`
    - 实现 DocumentOpsExecutor 类
    - 实现 handleAddTextBlock, handleUpdateTextBlock, handleRemoveTextBlock, handleMoveBlock
    - 集成现有 OpsExecutor 处理 canvas ops
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 5.2 编写 AddTextBlock 执行的 property test
    - **Property 6: AddTextBlock Execution Correctness**
    - **Validates: Requirements 4.1**
  - [ ]* 5.3 编写 UpdateTextBlock 执行的 property test
    - **Property 7: UpdateTextBlock Execution Correctness**
    - **Validates: Requirements 4.2**
  - [ ]* 5.4 编写 RemoveTextBlock 执行的 property test
    - **Property 8: RemoveTextBlock Execution Correctness**
    - **Validates: Requirements 4.3**
  - [ ]* 5.5 编写 MoveBlock 执行的 property test
    - **Property 9: MoveBlock Execution Correctness**
    - **Validates: Requirements 4.4**
  - [ ]* 5.6 编写 Ops 幂等性的 property test
    - **Property 10: Ops Idempotency**
    - **Validates: Requirements 4.5**
  - [ ]* 5.7 编写单 block 删除保护的 property test
    - **Property 11: Single Block Deletion Prevention**
    - **Validates: Requirements 6.5**

- [ ] 6. Checkpoint - 确保 Ops Executor 测试通过
  - 运行 `pnpm test` 确保所有测试通过
  - 如有问题请询问用户

- [ ] 7. Selection Bus 实现
  - [ ] 7.1 创建 `src/lib/selection/selectionBus.ts`
    - 使用 Zustand 实现 SelectionBus store
    - 实现 getSelection, setSelection, clearSelection, subscribe
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 7.2 编写 Selection Bus 状态一致性的 property test
    - **Property 12: Selection Bus State Consistency**
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 7.3 编写 Selection 结构验证的 property test
    - **Property 13: Selection Structure by Type**
    - **Validates: Requirements 7.3, 7.4**
  - [ ]* 7.4 编写 Selection 清除的 property test
    - **Property 14: Selection Clearing on Focus Change**
    - **Validates: Requirements 7.5**

- [ ] 8. TextBlock 组件实现
  - [ ] 8.1 创建 `src/components/blocks/TextBlock.tsx`
    - 集成 Tiptap editor
    - 配置 StarterKit, Placeholder 扩展
    - 实现 onFocus, onBlur, onContentChange 回调
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ] 8.2 创建 `src/components/blocks/TextBlock.css` 样式文件
    - 定义 Tiptap 编辑器样式
    - 支持 dark mode
    - _Requirements: 2.1_

- [ ] 9. BlockRenderer 组件实现
  - [ ] 9.1 创建 `src/components/blocks/BlockRenderer.tsx`
    - 按 blocks 顺序渲染 TextBlock 或 CanvasBlock
    - 实现 block 添加菜单
    - 实现 block 删除确认
    - _Requirements: 5.1, 6.1, 6.2, 6.4, 6.5_
  - [ ] 9.2 实现 block 拖拽排序
    - 使用 @dnd-kit/core 实现拖拽
    - 拖拽完成后生成 moveBlock op
    - _Requirements: 6.3_

- [ ] 10. Checkpoint - 确保 UI 组件可渲染
  - 运行 `pnpm dev` 检查组件渲染
  - 如有问题请询问用户

- [ ] 11. EditorLayout 集成
  - [ ] 11.1 修改 `src/components/editor/EditorLayout.tsx`
    - 集成 BlockRenderer
    - 实现 Focus Manager 逻辑
    - 连接 Selection Bus
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 11.2 实现 block 间焦点切换
    - Tab 键切换到下一个 block
    - 点击切换焦点
    - _Requirements: 5.2, 5.3, 5.5_

- [ ] 12. 数据持久化
  - [ ] 12.1 扩展 Supabase schema
    - 添加 doc_model JSONB 列到 documents 表
    - 创建迁移脚本
    - _Requirements: 8.2, 8.3_
  - [ ] 12.2 实现 Document 保存和加载
    - 创建 `src/lib/supabase/queries/documentModel.ts`
    - 实现 saveDocumentModel, loadDocumentModel 函数
    - 实现 debounced auto-save
    - _Requirements: 8.1, 8.4_
  - [ ]* 12.3 编写持久化往返的 property test
    - **Property 15: Document Persistence Round-Trip**
    - **Validates: Requirements 8.4**

- [ ] 13. AI 集成扩展
  - [ ] 13.1 扩展 AI schema 支持 TextOps
    - 修改 `src/ai/schema/` 添加 text op 定义
    - 更新 generate-ops Edge Function prompt
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ] 13.2 更新 ChatPanel 处理 text ops
    - 修改 onOpsGenerated 处理 TextOp
    - _Requirements: 9.1, 9.2_

- [ ] 14. Final Checkpoint - 完整功能测试
  - 运行 `pnpm test` 确保所有测试通过
  - 运行 `pnpm build` 确保构建成功
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional property-based tests
- 现有 Canvas 功能保持不变，TextBlock 作为新的 block 类型加入
- 使用 fast-check 进行 property-based testing
- 每个 property test 运行 100+ iterations
