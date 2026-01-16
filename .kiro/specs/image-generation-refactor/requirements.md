# Requirements Document

## Introduction

重构 Fluxa 图片生成接口，提升代码工程化水平。目标是将现有的 900+ 行单文件 Edge Function 拆分为清晰的模块结构，实现 Provider 抽象、统一错误处理、类型安全和可测试性。

## Glossary

- **Image_Provider**: 图片生成服务提供商抽象接口（Gemini、Volcengine 等）
- **Provider_Factory**: 根据模型名称创建对应 Provider 实例的工厂
- **Request_Validator**: 请求参数验证模块
- **Auth_Service**: 认证授权服务模块
- **Points_Service**: 积分扣除服务模块
- **Asset_Service**: 资产管理服务模块（上传、创建记录）
- **Job_Service**: 任务队列服务模块
- **Error_Handler**: 统一错误处理模块
- **Edge_Function**: Supabase Edge Function 入口

## Requirements

### Requirement 1: Provider 抽象层

**User Story:** As a developer, I want a unified provider interface, so that I can easily add new image generation providers without modifying core logic.

#### Acceptance Criteria

1. THE System SHALL define an `ImageProvider` interface with `generate(request): Promise<ImageResult>` method
2. THE System SHALL implement `GeminiProvider` class conforming to `ImageProvider` interface
3. THE System SHALL implement `VolcengineProvider` class conforming to `ImageProvider` interface
4. THE System SHALL implement `ProviderFactory` to create provider instances based on model name
5. WHEN a new provider is added, THE System SHALL only require implementing `ImageProvider` interface
6. THE Provider implementations SHALL be located in `supabase/functions/_shared/providers/` directory

### Requirement 2: 请求验证模块

**User Story:** As a developer, I want centralized request validation, so that validation logic is reusable and testable.

#### Acceptance Criteria

1. THE System SHALL implement `RequestValidator` module in `_shared/validators/`
2. THE RequestValidator SHALL validate required fields (projectId, documentId, prompt)
3. THE RequestValidator SHALL validate optional fields with type checking (model, width, height, aspectRatio, resolution)
4. THE RequestValidator SHALL return typed validation result with specific error messages
5. WHEN validation fails, THE System SHALL return structured error with field-level details
6. THE RequestValidator SHALL export TypeScript types for validated request

### Requirement 3: 认证授权模块

**User Story:** As a developer, I want separated auth logic, so that authentication and authorization are consistent across functions.

#### Acceptance Criteria

1. THE System SHALL implement `AuthService` module in `_shared/services/`
2. THE AuthService SHALL provide `validateUser(authHeader): Promise<User>` method
3. THE AuthService SHALL provide `validateProjectAccess(userId, projectId): Promise<boolean>` method
4. THE AuthService SHALL provide `validateDocumentAccess(userId, documentId): Promise<boolean>` method
5. THE AuthService SHALL provide `getUserMembership(userId): Promise<Membership>` method
6. WHEN auth fails, THE AuthService SHALL throw typed `AuthError` with specific code

### Requirement 4: 积分服务模块

**User Story:** As a developer, I want isolated points logic, so that billing calculations are centralized and auditable.

#### Acceptance Criteria

1. THE System SHALL implement `PointsService` module in `_shared/services/`
2. THE PointsService SHALL provide `calculateCost(model, resolution): Promise<number>` method
3. THE PointsService SHALL provide `deductPoints(userId, amount, source, modelName): Promise<DeductResult>` method
4. THE PointsService SHALL provide `checkBalance(userId, requiredAmount): Promise<boolean>` method
5. WHEN points insufficient, THE PointsService SHALL throw `InsufficientPointsError` with balance details
6. THE PointsService SHALL support resolution-based cost multipliers (1K=1x, 2K=1.5x, 4K=2x)

### Requirement 5: 资产服务模块

**User Story:** As a developer, I want centralized asset management, so that storage operations are consistent and traceable.

#### Acceptance Criteria

1. THE System SHALL implement `AssetService` module in `_shared/services/`
2. THE AssetService SHALL provide `uploadImage(userId, projectId, imageData, contentType): Promise<Asset>` method
3. THE AssetService SHALL provide `createAssetRecord(asset): Promise<string>` method
4. THE AssetService SHALL provide `getPublicUrl(storagePath): string` method
5. THE AssetService SHALL provide `validateOwnership(userId, assetId): Promise<boolean>` method
6. THE AssetService SHALL generate unique asset IDs and storage paths

### Requirement 6: 任务服务模块

**User Story:** As a developer, I want abstracted job management, so that async processing is consistent across features.

#### Acceptance Criteria

1. THE System SHALL implement `JobService` module in `_shared/services/`
2. THE JobService SHALL provide `createJob(type, input, userId): Promise<Job>` method
3. THE JobService SHALL provide `updateStatus(jobId, status, output?, error?): Promise<void>` method
4. THE JobService SHALL provide `getJob(jobId): Promise<Job>` method
5. THE JobService SHALL support job statuses: queued, processing, done, failed
6. THE JobService SHALL store job metadata including model, resolution, aspectRatio

### Requirement 7: 统一错误处理

**User Story:** As a developer, I want consistent error handling, so that API responses are predictable and debuggable.

#### Acceptance Criteria

1. THE System SHALL implement `ErrorHandler` module in `_shared/errors/`
2. THE ErrorHandler SHALL define error classes: `ValidationError`, `AuthError`, `ProviderError`, `PointsError`, `InternalError`
3. THE ErrorHandler SHALL provide `toResponse(error): Response` method for Edge Function responses
4. THE ErrorHandler SHALL include error codes: INVALID_REQUEST, UNAUTHORIZED, INSUFFICIENT_POINTS, PROVIDER_ERROR, INTERNAL_ERROR
5. WHEN an error occurs, THE System SHALL log error with context before returning response
6. THE ErrorHandler SHALL preserve error stack traces in development mode

### Requirement 8: Edge Function 入口重构

**User Story:** As a developer, I want a clean Edge Function entry point, so that the request flow is easy to understand and maintain.

#### Acceptance Criteria

1. THE generate-image Edge Function SHALL be refactored to under 200 lines
2. THE Edge Function SHALL orchestrate modules: validate → auth → points → job → process → respond
3. THE Edge Function SHALL use dependency injection for services
4. THE Edge Function SHALL handle CORS preflight requests
5. THE Edge Function SHALL use `EdgeRuntime.waitUntil` for async job processing
6. THE Edge Function SHALL return consistent JSON response structure

### Requirement 9: 类型安全

**User Story:** As a developer, I want comprehensive TypeScript types, so that the codebase is self-documenting and IDE-friendly.

#### Acceptance Criteria

1. THE System SHALL define all request/response types in `_shared/types/`
2. THE System SHALL export `ImageGenerateRequest`, `ImageGenerateResponse`, `JobOutput` types
3. THE System SHALL use strict TypeScript with no `any` types in public APIs
4. THE System SHALL provide type guards for runtime type checking
5. THE System SHALL document complex types with JSDoc comments
6. THE types SHALL be importable by both Edge Functions and tests

### Requirement 10: 可测试性

**User Story:** As a developer, I want testable modules, so that I can write unit tests without mocking entire systems.

#### Acceptance Criteria

1. THE modules SHALL accept dependencies via constructor or function parameters
2. THE modules SHALL not directly access `Deno.env` except in factory functions
3. THE modules SHALL export pure functions where possible
4. THE System SHALL provide mock implementations for testing
5. THE modules SHALL have single responsibility for easier testing
6. THE System SHALL maintain existing test coverage after refactoring

