# Implementation Plan: Image Generation Refactor

## Overview

将现有的 900+ 行 `generate-image` Edge Function 重构为模块化架构，实现 Provider 抽象、服务分离、统一错误处理和类型安全。

## Tasks

- [x] 1. 创建共享类型和错误处理模块
  - [x] 1.1 创建类型定义文件 `_shared/types/index.ts`
    - 定义 `AspectRatio`, `ResolutionPreset` 类型
    - 定义 `ImageGenerateRequest`, `ImageGenerateResponse`, `JobOutput` 类型
    - 导出所有共享类型
    - _Requirements: 9.1, 9.2_

  - [x] 1.2 创建错误处理模块 `_shared/errors/index.ts`
    - 实现 `AppError` 基类
    - 实现 `ValidationError`, `AuthError`, `ProviderError`, `InsufficientPointsError`, `InternalError`
    - 实现 `errorToResponse` 函数
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 1.3 编写 Property Test: Error to Response Mapping
    - **Property 9: Error to Response Mapping**
    - **Validates: Requirements 7.3**

- [x] 2. Checkpoint - 验证基础模块
  - 确保类型定义正确，错误处理模块可用

- [x] 3. 创建 Provider 抽象层
  - [x] 3.1 创建 Provider 接口 `_shared/providers/types.ts`
    - 定义 `ImageResult`, `ProviderRequest`, `ProviderCapabilities` 接口
    - 定义 `ImageProvider` 接口
    - 定义 `ValidationResult` 类型
    - _Requirements: 1.1_

  - [x] 3.2 实现 Gemini Provider `_shared/providers/gemini.ts`
    - 从现有 `gemini-provider.ts` 迁移代码
    - 实现 `ImageProvider` 接口
    - 添加 `validateRequest` 方法
    - _Requirements: 1.2_

  - [x] 3.3 实现 Volcengine Provider `_shared/providers/volcengine.ts`
    - 从现有 `generate-image/index.ts` 提取 Volcengine 逻辑
    - 实现 `ImageProvider` 接口
    - 处理 URL 和 base64 两种响应格式
    - _Requirements: 1.3_

  - [x] 3.4 实现 Provider Factory `_shared/providers/factory.ts`
    - 创建 `ProviderFactory` 类
    - 注册所有支持的模型
    - 实现 `getProvider`, `isSupported`, `getDefaultProvider` 方法
    - _Requirements: 1.4_

  - [x]* 3.5 编写 Property Test: Provider Factory Returns Valid Provider
    - **Property 1: Provider Factory Returns Valid Provider**
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint - 验证 Provider 层
  - 确保所有 Provider 实现正确，Factory 可用

- [x] 5. 创建请求验证模块
  - [x] 5.1 实现 RequestValidator `_shared/validators/request.ts`
    - 创建 `RequestValidator` 类
    - 实现必填字段验证 (projectId, documentId, prompt)
    - 实现可选字段类型验证 (aspectRatio, resolution)
    - 返回类型化的 `ValidationResult`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 编写 Property Test: Request Validation Completeness
    - **Property 2: Request Validation Completeness**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 6. 创建服务模块
  - [x] 6.1 实现 AuthService `_shared/services/auth.ts`
    - 创建 `AuthService` 类
    - 实现 `validateUser`, `validateProjectAccess`, `validateDocumentAccess`
    - 实现 `getUserMembership`
    - 抛出类型化的 `AuthError`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 6.2 编写 Property Test: Auth Error Typing
    - **Property 3: Auth Error Typing**
    - **Validates: Requirements 3.6**

  - [x] 6.3 实现 PointsService `_shared/services/points.ts`
    - 创建 `PointsService` 类
    - 实现 `calculateCost` 含分辨率倍率
    - 实现 `deductPoints` 调用 RPC
    - 实现 `getModelDisplayName`
    - 抛出 `InsufficientPointsError`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 6.4 编写 Property Test: Points Cost Calculation
    - **Property 4: Points Cost Calculation with Resolution Multiplier**
    - **Validates: Requirements 4.2, 4.6**

  - [ ]* 6.5 编写 Property Test: Insufficient Points Error
    - **Property 5: Insufficient Points Error Contains Balance Details**
    - **Validates: Requirements 4.5**

  - [x] 6.6 实现 AssetService `_shared/services/asset.ts`
    - 创建 `AssetService` 类
    - 实现 `uploadImage` 含存储和记录创建
    - 实现 `getPublicUrl`
    - 实现 `validateOwnership`
    - 实现 `getImageDimensions` 辅助方法
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.7 编写 Property Test: Asset ID Uniqueness
    - **Property 6: Asset ID Uniqueness**
    - **Validates: Requirements 5.6**

  - [ ]* 6.8 编写 Property Test: Public URL Format
    - **Property 7: Public URL Format**
    - **Validates: Requirements 5.4**

  - [x] 6.9 实现 JobService `_shared/services/job.ts`
    - 创建 `JobService` 类
    - 实现 `createJob`, `updateStatus`, `getJob`
    - 支持 queued, processing, done, failed 状态
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.10 编写 Property Test: Job Status Lifecycle
    - **Property 8: Job Status Lifecycle**
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [ ] 7. Checkpoint - 验证服务模块
  - 确保所有服务模块正确实现，测试通过

- [x] 8. 重构 Edge Function 入口
  - [x] 8.1 重构 `generate-image/index.ts`
    - 精简到 200 行以内
    - 使用依赖注入组装服务
    - 实现请求流程：validate → auth → points → job → process → respond
    - 处理 CORS preflight
    - 使用 `EdgeRuntime.waitUntil` 异步处理
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 8.2 编写 Property Test: Successful Response Structure
    - **Property 10: Successful Response Structure**
    - **Validates: Requirements 8.6**

- [ ] 9. 清理和迁移
  - [ ] 9.1 更新现有 `gemini-provider.ts`
    - 保留为兼容层或删除
    - 更新导入路径
    - _Requirements: 1.2_

  - [ ] 9.2 更新现有 `conversation-context.ts`
    - 确保与新架构兼容
    - 更新类型导入
    - _Requirements: 2.1, 2.6, 2.7_

  - [ ] 9.3 创建 barrel exports `_shared/index.ts`
    - 导出所有公共 API
    - 便于其他 Edge Functions 使用
    - _Requirements: 9.6_

- [ ] 10. Checkpoint - 验证重构完成
  - 确保所有测试通过
  - 验证 Edge Function 正常工作
  - 确认代码行数符合要求

- [ ] 11. 更新 Next.js API Route
  - [ ] 11.1 验证 `src/app/api/generate-image/route.ts`
    - 确认与重构后的 Edge Function 兼容
    - 无需修改（仅代理请求）
    - _Requirements: 8.6_

- [ ] 12. Final Checkpoint - 完整功能验证
  - 确保所有测试通过
  - 验证端到端流程正常
  - 如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选的 Property-Based 测试任务
- 每个 Property Test 使用 fast-check 库，最少运行 100 次迭代
- Edge Function 使用 Deno 运行时
- 重构过程中保持向后兼容，避免破坏现有功能
- 测试文件放在 `tests/image-generation/` 目录下

