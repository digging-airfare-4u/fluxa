# Implementation Plan: Image Toolbar

## Overview

本实现计划将图片浮动工具栏功能分解为可执行的编码任务。任务按照依赖关系排序，确保增量开发和早期验证。

## Tasks

- [ ] 1. 创建 ImageToolbar 组件基础结构
  - [ ] 1.1 创建类型定义文件 `ImageToolbar.types.ts`
    - 定义 `ImageToolbarProps` 接口
    - 定义 `ImageToolbarLoadingStates` 接口
    - 定义 `ToolAction` 接口
    - _Requirements: 2.1, 2.2_

  - [ ] 1.2 创建工具配置文件 `ImageToolbar.config.ts`
    - 定义 `IMAGE_TOOLBAR_TOOLS` 数组
    - 定义 `MORE_MENU_ITEMS` 数组
    - 配置图标和标签映射
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 1.3 创建 ImageToolbar 组件主文件
    - 实现基础 UI 布局（水平按钮行）
    - 实现视觉分隔符
    - 实现主题适配（light/dark）
    - 实现阴影和边框样式
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [ ]* 1.4 编写 ImageToolbar 组件单元测试
    - 测试组件渲染
    - 测试按钮点击事件
    - 测试加载状态显示
    - _Requirements: 2.1-2.6_

- [ ] 2. 集成 ImageToolbar 到 CanvasStage
  - [ ] 2.1 添加图片选择检测逻辑
    - 在 `updateSelectionInfo` 中检测对象类型
    - 当选中图片时设置 `imageToolbarInfo` 状态
    - 当选中非图片或取消选择时清除状态
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 2.2 实现工具栏定位逻辑
    - 计算屏幕坐标（考虑 viewport transform）
    - 实现水平居中定位
    - 实现边缘检测（靠近顶部时显示在下方）
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ] 2.3 实现多选检测
    - 检测 `ActiveSelection` 类型
    - 多选时隐藏 ImageToolbar
    - _Requirements: 1.7_

  - [ ]* 2.4 编写属性测试：选择类型决定工具栏可见性
    - **Property 1: Selection Type Determines Toolbar Visibility**
    - 生成随机对象类型，验证工具栏显示逻辑
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.7**

  - [ ]* 2.5 编写属性测试：工具栏定位
    - **Property 2: Toolbar Positioning Follows Image**
    - 生成随机位置和 viewport transform，验证定位计算
    - **Validates: Requirements 1.4, 1.5, 1.6**

- [ ] 3. Checkpoint - 基础 UI 验证
  - 确保 ImageToolbar 在选中图片时正确显示
  - 确保定位逻辑正确
  - 确保所有测试通过，如有问题请询问用户

- [ ] 4. 实现基础功能（下载、复制、删除）
  - [ ] 4.1 实现图片下载功能
    - 获取选中图片的原始数据
    - 创建 Blob 并触发下载
    - 生成文件名（包含时间戳）
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.2 实现下载错误处理
    - 捕获导出异常
    - 显示错误 toast 通知
    - _Requirements: 3.4_

  - [ ]* 4.3 编写属性测试：导出保持原始分辨率
    - **Property 3: Image Export Preserves Original Resolution**
    - 验证导出图片尺寸与原始一致
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 4.4 实现图片复制功能
    - 复用现有 `handleCopy` 逻辑
    - 添加成功反馈 toast
    - _Requirements: 4.1, 4.2_

  - [ ] 4.5 实现图片删除功能
    - 复用现有 `deleteSelected` 逻辑
    - 确保工具栏消失
    - _Requirements: 5.1, 5.2_

  - [ ]* 4.6 编写属性测试：复制粘贴往返
    - **Property 4: Copy-Paste Round Trip**
    - 验证复制后粘贴产生等效对象
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 4.7 编写属性测试：删除操作正确性
    - **Property 5: Delete Operation Correctness**
    - 验证删除后对象移除、工具栏消失、可撤销
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 5. 实现更多操作菜单
  - [ ] 5.1 创建 MoreMenu 下拉组件
    - 使用 shadcn/ui DropdownMenu
    - 实现菜单项列表
    - 实现分隔符
    - _Requirements: 10.1, 10.2_

  - [ ] 5.2 实现菜单交互逻辑
    - 点击外部关闭菜单
    - 选择菜单项后执行操作并关闭
    - _Requirements: 10.3, 10.4_

  - [ ] 5.3 实现图层排序功能
    - 置于顶层 (bringToFront)
    - 置于底层 (sendToBack)
    - 上移一层 (bringForward)
    - 下移一层 (sendBackward)
    - _Requirements: 10.2_

  - [ ] 5.4 实现锁定/解锁功能
    - 切换图片的 `selectable` 和 `evented` 属性
    - 更新菜单项图标和文本
    - _Requirements: 10.2_

  - [ ]* 5.5 编写属性测试：菜单操作执行
    - **Property 9: Menu Action Execution**
    - 验证菜单项选择触发正确操作
    - **Validates: Requirements 10.1, 10.4**

- [ ] 6. Checkpoint - 基础功能验证
  - 确保下载、复制、删除功能正常
  - 确保更多菜单功能正常
  - 确保所有测试通过，如有问题请询问用户

- [ ] 7. 添加国际化支持
  - [ ] 7.1 添加中文翻译 (zh-CN)
    - 更新 `src/locales/zh-CN/editor.json`
    - 添加 `image_toolbar` 命名空间下的所有键
    - _Requirements: 11.1, 11.3_

  - [ ] 7.2 添加英文翻译 (en-US)
    - 更新 `src/locales/en-US/editor.json`
    - 添加 `image_toolbar` 命名空间下的所有键
    - _Requirements: 11.1, 11.3_

  - [ ] 7.3 更新组件使用 i18n
    - 使用 `useT('editor')` hook
    - 替换所有硬编码文本
    - 添加 aria-label 翻译
    - _Requirements: 11.1, 11.2_

- [ ] 8. 实现键盘快捷键
  - [ ] 8.1 添加复制快捷键 (Cmd/Ctrl+C)
    - 在现有 keyboard shortcuts effect 中添加
    - 确保与现有快捷键不冲突
    - _Requirements: 12.2, 12.4_

  - [ ] 8.2 添加复制快捷键 (Cmd/Ctrl+D)
    - 实现图片复制功能
    - 复制后偏移位置
    - _Requirements: 12.3, 12.4_

  - [ ]* 8.3 编写属性测试：键盘快捷键一致性
    - **Property 8: Keyboard Shortcuts Consistency**
    - 验证快捷键与按钮操作等效
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 9. 实现可访问性支持
  - [ ] 9.1 添加键盘导航
    - 确保 Tab 键可在按钮间导航
    - 确保 Enter/Space 可触发按钮
    - _Requirements: 13.1_

  - [ ] 9.2 添加 ARIA 属性
    - 为所有按钮添加 aria-label
    - 为禁用按钮添加 aria-disabled
    - 为菜单添加 aria-expanded
    - _Requirements: 13.2, 13.4_

- [ ] 10. Checkpoint - 完整功能验证
  - 确保国际化正常工作
  - 确保键盘快捷键正常
  - 确保可访问性符合要求
  - 确保所有测试通过，如有问题请询问用户

- [ ] 11. 创建 AI 图片处理 API 客户端
  - [ ] 11.1 创建 `imageProcessing.ts` API 文件
    - 定义请求/响应类型
    - 实现 `removeBackground` 函数
    - 实现 `upscaleImage` 函数
    - 实现 `inpaintImage` 函数
    - 实现 `outpaintImage` 函数
    - _Requirements: 6.1, 7.1, 8.3, 9.3_

  - [ ] 11.2 实现错误处理
    - 定义 `ImageToolbarErrorCode` 枚举
    - 实现 `ImageProcessingApiError` 类
    - 处理积分不足错误
    - _Requirements: 6.4, 6.6, 7.5, 7.6_

- [ ] 12. 实现 AI 背景移除功能
  - [ ] 12.1 添加背景移除按钮处理
    - 获取选中图片 URL
    - 调用 `removeBackground` API
    - 管理加载状态
    - _Requirements: 6.1, 6.2_

  - [ ] 12.2 实现图片替换逻辑
    - 用处理后的图片替换原图
    - 保持位置和尺寸
    - 记录到撤销历史
    - _Requirements: 6.3, 6.5_

  - [ ] 12.3 实现错误处理和积分验证
    - 显示错误消息
    - 显示积分不足提示
    - _Requirements: 6.4, 6.6_

- [ ] 13. 实现 AI 图片放大功能
  - [ ] 13.1 添加放大按钮处理
    - 获取选中图片 URL
    - 调用 `upscaleImage` API
    - 管理加载状态
    - _Requirements: 7.1, 7.2_

  - [ ] 13.2 实现图片替换逻辑
    - 用高分辨率图片替换原图
    - 保持视觉尺寸（调整 scale）
    - _Requirements: 7.3, 7.4_

  - [ ] 13.3 实现错误处理
    - 显示错误消息
    - 显示积分不足提示
    - _Requirements: 7.5, 7.6_

- [ ] 14. 实现 AI 智能擦除功能
  - [ ] 14.1 实现擦除模式切换
    - 点击擦除按钮进入擦除模式
    - 更改画布光标为画笔
    - 创建遮罩画布层
    - _Requirements: 8.1, 8.2_

  - [ ] 14.2 实现遮罩绘制
    - 实现画笔绘制逻辑
    - 支持画笔大小调整
    - 显示确认/取消按钮
    - _Requirements: 8.2_

  - [ ] 14.3 实现擦除 API 调用
    - 将遮罩转换为 DataURL
    - 调用 `inpaintImage` API
    - 管理加载状态
    - _Requirements: 8.3, 8.4_

  - [ ] 14.4 实现结果处理
    - 用处理后的图片替换原图
    - 清除遮罩层
    - 退出擦除模式
    - _Requirements: 8.5_

  - [ ] 14.5 实现取消逻辑
    - 丢弃遮罩
    - 恢复正常选择模式
    - _Requirements: 8.6_

  - [ ] 14.6 实现错误处理
    - 显示错误消息
    - 显示积分不足提示
    - _Requirements: 8.7_

- [ ] 15. 实现 AI 图片扩展功能
  - [ ] 15.1 实现扩展方向选择 UI
    - 创建方向选择弹出框
    - 支持上/下/左/右/全部方向
    - 支持自定义像素数
    - _Requirements: 9.1_

  - [ ] 15.2 实现扩展预览
    - 显示扩展区域预览框
    - 支持拖拽调整
    - _Requirements: 9.2_

  - [ ] 15.3 实现扩展 API 调用
    - 调用 `outpaintImage` API
    - 管理加载状态
    - _Requirements: 9.3, 9.4_

  - [ ] 15.4 实现结果处理
    - 用扩展后的图片替换原图
    - 调整图片位置以保持视觉中心
    - _Requirements: 9.5_

  - [ ] 15.5 实现错误处理
    - 显示错误消息
    - 显示积分不足提示
    - _Requirements: 9.6, 9.7_

- [ ]* 16. 编写 AI 操作属性测试
  - [ ]* 16.1 编写属性测试：AI 操作状态机
    - **Property 6: AI Operation State Machine**
    - 验证状态转换：Initial → Loading → Success/Error
    - **Validates: Requirements 6.1-6.5, 7.1-7.4, 8.1-8.6, 9.3-9.5**

  - [ ]* 16.2 编写属性测试：积分验证
    - **Property 7: Points Validation Before AI Operations**
    - 验证积分不足时阻止 API 调用
    - **Validates: Requirements 6.6, 7.6, 8.7, 9.7**

- [ ] 17. Final Checkpoint - 完整功能验证
  - 确保所有 AI 功能正常工作
  - 确保错误处理正确
  - 确保所有测试通过
  - 如有问题请询问用户

- [ ] 18. 更新导出和文档
  - [ ] 18.1 更新 `src/components/canvas/index.ts`
    - 导出 ImageToolbar 组件
    - 导出相关类型
    - _Requirements: N/A_

  - [ ] 18.2 添加组件文档注释
    - 添加 JSDoc 注释
    - 添加使用示例
    - _Requirements: N/A_

## Notes

- 标记为 `*` 的任务为可选测试任务，可跳过以加快 MVP 开发
- 每个 Checkpoint 用于验证阶段性成果
- AI 功能（任务 11-16）依赖后端 Edge Function 支持，如未实现可先跳过
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代
