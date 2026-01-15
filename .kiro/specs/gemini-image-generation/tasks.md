# Implementation Plan: Gemini Image Generation (Nano Banana)

## Overview

本实现计划将 Gemini 图像生成功能分解为可执行的编码任务，包括数据库配置、Edge Function 实现、前端集成和测试。

## Tasks

- [ ] 1. 数据库配置与迁移
  - [x] 1.1 添加 Gemini 模型到 ai_models 表
    - 插入 `gemini-3-pro-image-preview` 记录，display_name 为 "Nano Banana Pro"
    - 设置 provider 为 "google"，points_cost 为 40
    - _Requirements: 5.1, 6.2, 6.6, 7.1_

  - [x] 1.2 更新 membership_configs.perks 添加分辨率权限
    - free 级别设置 max_image_resolution 为 "1K"
    - pro 级别设置 max_image_resolution 为 "2K"
    - team 级别设置 max_image_resolution 为 "4K"
    - _Requirements: 3.1, 7.2_

  - [x] 1.3 添加 system_settings 配置项
    - 插入 gemini_api_host 配置，默认值为 `https://generativelanguage.googleapis.com`
    - 确保 system_settings 表对 Edge Functions 可读
    - _Requirements: 7.5, 7.6, 7.7, 7.8_

  - [x] 1.4 扩展 conversations 表支持多轮对话
    - 添加 `last_generated_asset_id` 字段，外键关联 assets(id)
    - 添加 `provider_context` JSONB 字段，存储各 provider 特有上下文
    - 现有 RLS 策略已覆盖，无需额外配置
    - _Requirements: 2.6, 2.7, 7.9_

- [ ] 2. Checkpoint - 验证数据库配置
  - 确保所有迁移成功执行，检查表结构和数据

- [x] 3. Edge Function - Gemini Provider 实现
  - [x] 3.1 创建 Gemini Provider 核心函数
    - 实现 `generateImageGemini` 函数
    - 支持 text-to-image 和 image-to-image 模式
    - 处理 aspectRatio 和 imageSize 参数，映射 1K/2K/4K 到具体像素并推导 width/height
    - 从 system_settings 读取 API host 配置
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.8, 4.1, 4.2, 7.6, 7.7_


  - [x] 3.5 实现点数消耗计算
    - 根据分辨率计算点数倍率 (1K=1.0x, 2K=1.5x, 4K=2.0x)
    - 集成到 generate-image Edge Function
    - 复用 `deduct_points` RPC，确保扣点与 job 创建保持事务性或补偿逻辑
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.8_

  - [ ]* 3.6 编写 Property Test: Points Cost by Resolution
    - **Property 2: Points Cost by Resolution**
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [] 4. Checkpoint - 验证 Gemini Provider
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. Edge Function - 多轮对话支持
  - [x] 5.1 实现 Conversation Context (目前只处理Gemini)管理
    - 创建 `getConversationContext` 函数，获取 last_generated_asset_id 和 provider_context
    - 实现 `updateConversationContext` 函数，更新上下文
    - 支持加载和恢复会话上下文
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7_

  - [ ]* 5.2 编写 Property Test: Conversation Context Lifecycle
    - **Property 3: Conversation Context Lifecycle**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6**

  - [x] 5.3 实现图像上下文传递
    - 在后续请求中包含上一张图像作为 inlineData
    - 通过 last_generated_asset_id 从 Storage 拉取用户自己的图片，校验归属后再传入 Gemini
    - 支持 "change background" 等编辑命令
    - _Requirements: 2.3, 2.4, 2.7_

  - [ ]* 5.4 编写 Property Test: Reference Image Inclusion
    - **Property 5: Reference Image Inclusion**
    - **Validates: Requirements 1.4, 2.3**

- [ ] 6. Checkpoint - 验证多轮对话功能
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. Edge Function - 集成与资产管理
  - [x] 7.1 集成 Gemini Provider 到 generate-image
    - 修改 generate-image/index.ts 支持 Gemini 模型
    - 根据 model 参数路由到对应 provider
    - 处理 Gemini 特有的请求参数，input/output 存储 model/resolution/aspectRatio/conversationId/asset_id
    - 复用 jobs 队列（queued → processing → done/failed）流程
    - _Requirements: 1.1, 1.2, 1.7, 6.4_

  - [x] 7.2 实现资产创建和 Op 生成
    - 上传生成的图像到 Supabase Storage
    - 创建 asset 记录
    - 生成 addImage op
    - _Requirements: 1.5, 1.6_

  - [ ]* 7.3 编写 Property Test: Asset and Op Creation
    - **Property 4: Asset and Op Creation**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 7.4 实现点数余额检查
    - 在生成前检查用户点数余额
    - 余额不足时返回 INSUFFICIENT_POINTS 错误
    - _Requirements: 5.6_

  - [ ]* 7.5 编写 Property Test: Insufficient Points Rejection
    - **Property 7: Insufficient Points Rejection**
    - **Validates: Requirements 5.6**

- [ ] 8. Checkpoint - 验证 Edge Function 完整功能
  - 确保所有测试通过，如有问题请询问用户

- [x] 9. 前端 - 模型选择器更新
  - [x] 9.1 验证 ModelSelector 组件
    - 确认从 ai_models 表获取的模型列表包含 Nano Banana Pro
    - 确认模型描述和点数消耗正确显示
    - _Requirements: 6.1, 6.3, 6.5_

  - [x] 9.2 添加分辨率选择器（可选）
    - 创建 ResolutionSelector 组件
    - 根据用户会员等级显示可用选项
    - 锁定/禁用超出权限或当前模型不支持的分辨率
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 9.3 添加宽高比选择器（可选）
    - 创建 AspectRatioSelector 组件
    - 提供常用预设 (1:1, 16:9, 9:16 等)
    - 默认选择 1:1
    - _Requirements: 4.3, 4.4_

- [ ] 10. 前端 - API 参数扩展（可选）
  - [ ] 10.1 更新 generate-image API route
    - 透传 aspectRatio, imageSize 参数到 Edge Function
    - 现有接口已支持 model, conversationId 等参数
    - _Requirements: 4.2, 3.8_

- [ ] 11. Checkpoint - 验证前端集成
  - 确保所有组件正常工作，如有问题请询问用户

- [ ] 12. 国际化支持
  - [ ] 12.1 添加 Gemini 相关翻译
    - 更新 en-US 和 zh-CN locale 文件
    - 添加模型名称、分辨率、错误消息翻译
    - _Requirements: 3.5, 5.6_

- [ ] 13. Final Checkpoint - 完整功能验证
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选的 Property-Based 测试任务
- 每个 Property Test 使用 fast-check 库，最少运行 100 次迭代
- Edge Function 使用 Deno 运行时
- 所有数据库操作需要考虑 RLS 策略
