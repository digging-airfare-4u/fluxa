# Implementation Plan: Membership Points Phase 1

## Overview

本任务列表将会员点数体系 Phase 1 分解为可执行的开发任务。按照数据库 → 后端 → 前端的顺序实现，每个阶段都有对应的测试任务。
说明: 涉及到表操作的直接使用superbase mcp 然后涉及到组件的使用shadn mcp
## Tasks

- [x] 1. 数据库表结构和 RLS 策略
  - [x] 1.1 创建 user_profiles 表
    - 字段：id (PK, FK → auth.users), membership_level, points, created_at, updated_at
    - 启用 RLS，创建 user_id 基于的访问策略
    - _Requirements: 1.1, 1.2, 1.6_
  - [x] 1.2 创建 point_transactions 表
    - 字段：id, user_id, type, amount, source, reference_id, model_name, balance_after, metadata, created_at
    - 启用 RLS，创建 user_id 基于的访问策略
    - 创建索引：user_id, created_at, type
    - _Requirements: 1.3, 1.6_
  - [x] 1.3 扩展 ai_models 表添加 points_cost 字段
    - 添加 points_cost INTEGER DEFAULT 10 列
    - 更新现有模型的点数配置：gpt-4o-mini=10, gpt-4o=20, doubao-seedream=30 等
    - _Requirements: 2.3_
  - [x] 1.4 创建 membership_configs 表并插入初始数据
    - 字段：level (PK), display_name, initial_points, perks
    - 插入 free/pro/team 三个等级的默认配置
    - _Requirements: 1.4_
  - [x] 1.5 创建用户注册触发器
    - 创建 handle_new_user() 函数：创建 user_profile + 赠送初始点数 + 创建 transaction 记录
    - 创建 trigger on auth.users AFTER INSERT
    - 确保幂等性（检查 profile 是否已存在）
    - _Requirements: 1.5, 6.1, 6.2, 6.3_
  - [ ]* 1.6 编写 RLS 策略测试
    - 测试用户只能访问自己的 profile 和 transactions
    - 测试跨用户访问被拒绝
    - _Requirements: 1.6_

- [x] 2. PostgreSQL 点数扣减函数
  - [x] 2.1 创建 deduct_points RPC 函数
    - 参数：p_user_id, p_amount, p_source, p_reference_id, p_model_name
    - 使用事务：检查余额 → 扣减 → 创建 transaction（含 model_name）→ 返回结果
    - 余额不足时抛出异常
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_
  - [x] 2.2 创建 get_model_points_cost RPC 函数
    - 参数：p_model_name
    - 从 ai_models 表查询 points_cost
    - 模型不存在时返回默认值 10
    - _Requirements: 2.3_
  - [x] 2.3 创建 get_user_points_summary RPC 函数
    - 返回：points, membership_level, today_spent, today_earned
    - _Requirements: 3.1, 3.4_
  - [ ]* 2.4 编写 deduct_points 属性测试
    - **Property 2: Points Deduction by Model**
    - **Property 3: Insufficient Points Rejection**
    - **Property 5: Balance Non-Negativity**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 2.7**

- [ ] 3. Checkpoint - 数据库层完成
  - 确保所有数据库迁移已应用
  - 确保 RLS 策略正确
  - 确保 RPC 函数可调用
  - 如有问题请询问用户

- [x] 4. 修改 generate-ops Edge Function
  - [x] 4.1 添加点数扣减逻辑
    - 根据请求中的 model 参数查询 points_cost
    - 调用 get_model_points_cost 获取消耗点数
    - 调用 deduct_points RPC 扣减
    - 失败时返回 INSUFFICIENT_POINTS 错误
    - 成功时在响应中包含 pointsDeducted, remainingPoints, modelUsed
    - _Requirements: 2.1, 2.5, 2.6_
  - [x] 4.2 添加 INSUFFICIENT_POINTS 错误处理
    - 定义错误码和响应格式
    - 包含 current_balance, required_points, model_name
    - _Requirements: 2.6, 4.1_

- [x] 5. 修改 generate-image Edge Function
  - [x] 5.1 添加点数扣减逻辑
    - 根据图像生成模型查询 points_cost（如 doubao-seedream=30）
    - 调用 deduct_points RPC 扣减
    - _Requirements: 2.2, 2.5, 2.6_
  - [x] 5.2 添加 INSUFFICIENT_POINTS 错误处理
    - _Requirements: 2.6, 4.2_

- [x] 6. 创建 get-points Edge Function
  - [x] 6.1 实现点数查询接口
    - GET /functions/v1/get-points
    - 调用 get_user_points_summary RPC
    - 返回 points, membership_level, today_spent, transactions (最近 10 条)
    - _Requirements: 3.1, 3.4_

- [x] 7. Checkpoint - 后端完成
  - 测试 generate-ops 点数扣减
  - 测试 generate-image 点数扣减
  - 测试 get-points 查询
  - 如有问题请询问用户

- [x] 8. 前端 TypeScript 类型定义
  - [x] 8.1 创建 points 相关类型
    - 创建 src/lib/supabase/types/points.ts
    - 定义 UserProfile, PointTransaction, MembershipConfig, PointsSummary 等类型
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 9. 前端状态管理
  - [x] 9.1 创建 usePointsStore (Zustand)
    - 状态：points, membershipLevel, isLoading, error
    - 方法：fetchPoints, subscribeToChanges
    - _Requirements: 3.3_
  - [x] 9.2 实现 Supabase Realtime 订阅
    - 订阅 user_profiles 表的 UPDATE 事件
    - 余额变化时更新 store
    - _Requirements: 3.2, 3.3_
  - [ ]* 9.3 编写 Realtime 订阅属性测试
    - **Property 8: Realtime Balance Sync**
    - **Validates: Requirements 3.2, 5.5**

- [x] 10. 前端 UI 组件
  - [x] 10.1 创建 PointsBalanceIndicator 组件
    - 显示点数图标 + 余额
    - 位置：顶栏用户区域
    - 点击跳转个人中心
    - _Requirements: 3.3_
  - [x] 10.2 创建 InsufficientPointsDialog 组件
    - 显示当前余额、所需点数
    - 提示未来升级选项
    - 可关闭，不阻塞 UI
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 10.3 修改 ChatPanel 处理 INSUFFICIENT_POINTS 错误
    - 捕获错误并显示 InsufficientPointsDialog
    - _Requirements: 4.1_
  - [x] 10.4 创建 UserProfilePoints 组件
    - 余额卡片：大字余额 + 等级徽章
    - 交易历史列表
    - _Requirements: 5.1, 5.2_
  - [x] 10.5 实现交易历史分页和筛选
    - 分页：每页 20 条
    - 筛选：全部/收入/支出
    - _Requirements: 5.3, 5.4_
  - [ ]* 10.6 编写交易历史查询属性测试
    - **Property 7: Transaction Query Correctness**
    - **Validates: Requirements 5.3, 5.4**

- [x] 11. 集成和布局
  - [x] 11.1 在 EditorLayout 顶栏添加 PointsBalanceIndicator
    - _Requirements: 3.3_
  - [x] 11.2 创建或更新个人中心页面
    - 添加 UserProfilePoints 组件
    - _Requirements: 5.1_
  - [x] 11.3 初始化时加载点数状态
    - 在 app layout 中初始化 usePointsStore
    - _Requirements: 3.3_

- [x] 12. 最终 Checkpoint
  - 端到端测试完整流程
  - 验证新用户注册获得初始点数
  - 验证 AI 生成扣减点数
  - 验证点数不足提示
  - 验证个人中心展示
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 进度
- 每个 Checkpoint 是验证阶段性成果的好时机
- Property tests 使用 fast-check 库，每个测试运行 100+ 次迭代
- 数据库迁移通过 Supabase MCP 的 apply_migration 工具执行
