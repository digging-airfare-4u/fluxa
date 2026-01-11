# Requirements Document

## Introduction

为 Fluxa 实现会员点数体系的第一阶段（MVP），包括用户点数余额管理、AI 功能消耗扣减、点数不足提示和个人中心展示。此阶段聚焦核心点数流转逻辑，暂不包含付费升级和每日登录奖励。

## Glossary

- **User_Profile**: 用户会员信息表，存储点数余额、会员等级等
- **Point_Transaction**: 点数交易记录表，记录所有点数变动
- **Membership_Config**: 会员配置表，定义各等级的基础权益
- **AI_Models**: AI 模型配置表，定义每个模型的点数消耗（已存在，需扩展）
- **Points_Service**: 点数服务模块，处理点数扣减和余额查询
- **Balance**: 用户当前点数余额
- **Spend**: 点数消耗操作（AI 生成、图片生成、导出）

## Requirements

### Requirement 1: 用户点数数据存储

**User Story:** As a 系统管理员, I want to 存储用户的点数余额和会员等级, so that 系统能追踪每个用户的点数状态。

#### Acceptance Criteria

1. THE User_Profile table SHALL store user_id, membership_level, points balance, and timestamps
2. THE User_Profile table SHALL reference auth.users(id) with CASCADE delete
3. THE Point_Transaction table SHALL record type (earn/spend/adjust), amount, source, reference_id, and balance_after
4. THE Membership_Config table SHALL define points costs for generate_ops, generate_image, and export per membership level
5. WHEN a new user registers, THE System SHALL automatically create a User_Profile with default values (free level, 100 initial points)
6. THE System SHALL enable RLS on all new tables with user_id based policies

### Requirement 2: 点数扣减逻辑

**User Story:** As a 用户, I want to 在使用 AI 功能时自动扣减点数, so that 我能按使用量消费点数。

#### Acceptance Criteria

1. WHEN a user calls generate-ops with a specific model, THE Points_Service SHALL deduct points based on that model's points_cost config
2. WHEN a user calls generate-image with a specific model, THE Points_Service SHALL deduct points based on that model's points_cost config
3. THE ai_models table SHALL have a points_cost column to configure per-model point consumption
4. WHEN points deduction occurs, THE System SHALL create a Point_Transaction record with source, reference_id, model_name, and balance_after
5. THE Points deduction and function execution SHALL be atomic (transaction) - if function fails, points are not deducted
6. IF user's balance is less than required points, THEN THE System SHALL reject the request with INSUFFICIENT_POINTS error code
7. THE Points_Service SHALL use database-level transaction to prevent race conditions and negative balance

### Requirement 3: 点数余额查询

**User Story:** As a 用户, I want to 查看我的点数余额, so that 我能了解剩余可用点数。

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to query current user's points balance and membership level
2. WHEN user's points balance changes, THE System SHALL broadcast the change via Supabase Realtime
3. THE Frontend SHALL subscribe to points balance changes and update UI in real-time
4. THE Balance query SHALL return: current_points, membership_level, and today's transactions summary

### Requirement 4: 点数不足提示

**User Story:** As a 用户, I want to 在点数不足时收到明确提示, so that 我知道为什么操作失败以及如何解决。

#### Acceptance Criteria

1. WHEN generate-ops returns INSUFFICIENT_POINTS error, THE ChatPanel SHALL display a friendly insufficient points message
2. WHEN generate-image returns INSUFFICIENT_POINTS error, THE System SHALL display a friendly insufficient points message
3. THE insufficient points message SHALL show: current balance, required points, and a hint about future upgrade options
4. THE insufficient points dialog SHALL NOT block the UI - user can dismiss and continue browsing

### Requirement 5: 个人中心点数展示

**User Story:** As a 用户, I want to 在个人中心查看点数详情和交易历史, so that 我能掌握点数使用情况。

#### Acceptance Criteria

1. THE User Profile page SHALL display: current points balance, membership level badge, and points usage summary
2. THE User Profile page SHALL show a transaction history list with: type icon, source description, amount (+/-), timestamp
3. THE Transaction history SHALL support pagination (20 items per page)
4. THE Transaction history SHALL support filtering by type (earn/spend/all)
5. WHEN a new transaction occurs, THE Transaction history SHALL update in real-time without page refresh

### Requirement 6: 初始点数赠送

**User Story:** As a 新用户, I want to 注册后获得初始点数, so that 我能立即体验产品功能。

#### Acceptance Criteria

1. WHEN a new user completes registration, THE System SHALL grant 100 initial points
2. THE initial points grant SHALL create a Point_Transaction record with source='registration' and type='earn'
3. THE initial points grant SHALL be idempotent - multiple triggers for same user SHALL NOT grant duplicate points
