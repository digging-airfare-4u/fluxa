# Design Document: Membership Points Phase 1

## Overview

本设计文档描述 Fluxa 会员点数体系 Phase 1 的技术实现方案。核心目标是建立点数流转的基础设施：数据存储、扣减逻辑、余额查询和 UI 展示。

设计遵循现有项目架构：
- 数据库：Supabase PostgreSQL + RLS
- 后端：Supabase Edge Functions (Deno)
- 前端：Next.js + React + Zustand + Supabase Realtime
- 测试：Vitest + fast-check

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ ChatPanel   │  │ UserProfile │  │ PointsBalanceIndicator  │  │
│  │ (扣减提示)  │  │ (个人中心)  │  │ (顶栏余额显示)          │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │   usePointsStore      │ ◄── Supabase Realtime    │
│              │   (Zustand + 订阅)    │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  generate-ops   │  │ generate-image  │  │  get-points     │  │
│  │  (+ 点数扣减)   │  │  (+ 点数扣减)   │  │  (余额查询)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                ▼                                 │
│                    ┌───────────────────────┐                    │
│                    │   deduct_points()     │                    │
│                    │   (PostgreSQL RPC)    │                    │
│                    └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase PostgreSQL                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  user_profiles  │  │point_transactions│ │membership_configs│ │
│  │  (余额+等级)    │  │  (交易记录)     │  │  (配置表)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Trigger: on_auth_user_created → create_user_profile()      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Database Tables

#### user_profiles
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK, FK → auth.users) | 用户 ID |
| membership_level | TEXT | 会员等级: 'free', 'pro', 'team' |
| points | INTEGER | 当前点数余额 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### point_transactions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | 交易 ID |
| user_id | UUID (FK → auth.users) | 用户 ID |
| type | TEXT | 类型: 'earn', 'spend', 'adjust' |
| amount | INTEGER | 变动数量 (正数增加，负数减少) |
| source | TEXT | 来源: 'registration', 'generate_ops', 'generate_image', 'export', 'admin' |
| reference_id | UUID | 关联 ID (job_id, message_id 等) |
| balance_after | INTEGER | 变动后余额 |
| metadata | JSONB | 额外信息 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### membership_configs
| Column | Type | Description |
|--------|------|-------------|
| level | TEXT (PK) | 等级名称 |
| display_name | TEXT | 显示名称 |
| initial_points | INTEGER | 初始赠送点数 |
| perks | JSONB | 权益配置 |

#### ai_models (扩展现有表)
| Column | Type | Description |
|--------|------|-------------|
| ... | ... | 现有字段保持不变 |
| points_cost | INTEGER | 每次调用消耗点数 (新增) |

**默认点数配置：**
- gpt-4o-mini: 10 点
- gpt-4o: 20 点
- gpt-4-turbo: 25 点
- claude-3-haiku: 8 点
- claude-3-sonnet: 15 点
- doubao-seed-1-6-vision: 5 点 (文本生成)
- doubao-seedream-4-5: 30 点 (图像生成)

### PostgreSQL Functions

#### deduct_points(p_user_id, p_amount, p_source, p_reference_id, p_model_name)
```sql
-- 原子性扣减点数，返回扣减结果
-- 如果余额不足，抛出异常
-- 成功时创建 point_transaction 记录（包含 model_name）
```

#### get_model_points_cost(p_model_name)
```sql
-- 根据模型名称获取点数消耗配置
-- 返回 points_cost，如果模型不存在返回默认值
```

#### get_user_points_summary(p_user_id)
```sql
-- 返回用户点数摘要：余额、等级、今日消耗
```

### Edge Function Interfaces

#### generate-ops (修改)
- 新增：根据选择的模型查询 points_cost
- 新增：调用前检查点数，调用 `deduct_points` RPC
- 新增错误码：`INSUFFICIENT_POINTS`
- 响应新增：`pointsDeducted`, `remainingPoints`, `modelUsed`

#### generate-image (修改)
- 同上，根据图像生成模型的 points_cost 扣减

#### get-points (新增)
```typescript
// GET /functions/v1/get-points
// Response: { points, membership_level, today_spent, transactions: [...] }
```

### Frontend Components

#### usePointsStore (Zustand)
```typescript
interface PointsState {
  points: number;
  membershipLevel: string;
  isLoading: boolean;
  error: string | null;
  fetchPoints: () => Promise<void>;
  subscribeToChanges: () => () => void;
}
```

#### PointsBalanceIndicator
- 位置：顶栏用户头像旁
- 显示：点数图标 + 余额数字
- 点击：跳转个人中心

#### InsufficientPointsDialog
- 触发：API 返回 INSUFFICIENT_POINTS
- 内容：当前余额、所需点数、升级提示
- 操作：关闭按钮

#### UserProfilePoints (个人中心组件)
- 余额卡片：大字显示余额 + 等级徽章
- 交易历史：列表 + 分页 + 筛选

## Data Models

### TypeScript Types

```typescript
// src/lib/supabase/types/points.ts

export type MembershipLevel = 'free' | 'pro' | 'team';

export type TransactionType = 'earn' | 'spend' | 'adjust';

export type TransactionSource = 
  | 'registration' 
  | 'generate_ops' 
  | 'generate_image' 
  | 'export' 
  | 'admin';

export interface UserProfile {
  id: string;
  membership_level: MembershipLevel;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  source: TransactionSource;
  reference_id: string | null;
  model_name: string | null; // 关联的模型名称
  balance_after: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MembershipConfig {
  level: MembershipLevel;
  display_name: string;
  initial_points: number;
  perks: {
    no_watermark?: boolean;
    priority_queue?: boolean;
  };
}

export interface AIModelWithCost {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  points_cost: number;
  is_enabled: boolean;
}

export interface PointsSummary {
  points: number;
  membership_level: MembershipLevel;
  today_spent: number;
  today_earned: number;
}

export interface DeductPointsResult {
  success: boolean;
  points_deducted: number;
  balance_after: number;
  transaction_id: string;
}

export interface InsufficientPointsError {
  code: 'INSUFFICIENT_POINTS';
  current_balance: number;
  required_points: number;
  membership_level: MembershipLevel;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: New User Profile Creation
*For any* newly registered user, the system SHALL create a user_profile record with the correct initial points (100 for free tier) and a corresponding point_transaction record with source='registration'.

**Validates: Requirements 1.5, 6.1, 6.2**

### Property 2: Points Deduction by Model
*For any* successful AI function call (generate-ops or generate-image), the user's points balance SHALL decrease by exactly the points_cost configured for the selected model, and a point_transaction record SHALL be created with the correct model_name and balance_after value.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Insufficient Points Rejection
*For any* user whose points balance is less than the required amount for an operation, the system SHALL reject the request with INSUFFICIENT_POINTS error and SHALL NOT deduct any points or create any transaction record.

**Validates: Requirements 2.5**

### Property 4: Transaction Atomicity
*For any* points deduction operation, if the associated function (generate-ops/generate-image) fails after points check but before completion, the points SHALL NOT be deducted and no transaction record SHALL be created.

**Validates: Requirements 2.4, 2.6**

### Property 5: Balance Non-Negativity
*For any* sequence of concurrent deduction operations on the same user, the final balance SHALL never be negative, and the sum of all transaction amounts SHALL equal the difference between initial and final balance.

**Validates: Requirements 2.6**

### Property 6: Idempotent Initial Points Grant
*For any* user, the initial points grant (registration bonus) SHALL occur exactly once, regardless of how many times the trigger or function is invoked.

**Validates: Requirements 6.3**

### Property 7: Transaction Query Correctness
*For any* transaction history query with pagination and filtering, the returned results SHALL match the filter criteria, be ordered by created_at descending, and the pagination SHALL correctly partition the full result set.

**Validates: Requirements 5.3, 5.4**

### Property 8: Realtime Balance Sync
*For any* points balance change (deduction or grant), a Supabase Realtime event SHALL be emitted, and subscribed clients SHALL receive the updated balance within a reasonable time window.

**Validates: Requirements 3.2, 5.5**

## Error Handling

### Error Codes

| Code | HTTP Status | Description | User Message |
|------|-------------|-------------|--------------|
| INSUFFICIENT_POINTS | 402 | 点数不足 | "点数不足，当前余额 {balance}，需要 {required} 点" |
| PROFILE_NOT_FOUND | 404 | 用户配置不存在 | "用户信息未找到，请重新登录" |
| DEDUCTION_FAILED | 500 | 扣减失败 | "点数扣减失败，请稍后重试" |
| CONFIG_NOT_FOUND | 500 | 配置缺失 | "系统配置错误，请联系支持" |

### Error Recovery

1. **INSUFFICIENT_POINTS**: 前端显示友好提示，引导用户了解点数获取方式
2. **PROFILE_NOT_FOUND**: 尝试自动创建 profile，失败则提示重新登录
3. **DEDUCTION_FAILED**: 自动重试一次，仍失败则提示用户稍后重试
4. **并发冲突**: 数据库事务自动处理，前端刷新余额

## Testing Strategy

### Unit Tests
- `deduct_points` RPC 函数的边界条件测试
- TypeScript 类型验证函数测试
- Zustand store 状态更新测试

### Property-Based Tests (fast-check)
- **Property 1**: 生成随机用户注册事件，验证 profile 和 transaction 创建
- **Property 2**: 生成随机扣减请求，验证余额变化和记录创建
- **Property 3**: 生成余额不足场景，验证拒绝行为
- **Property 5**: 生成并发扣减序列，验证最终一致性
- **Property 6**: 多次触发初始化，验证幂等性
- **Property 7**: 生成随机查询参数，验证分页和筛选正确性

### Integration Tests
- Edge Function 端到端测试（含点数扣减）
- Realtime 订阅测试
- RLS 策略测试（用户隔离）

### Test Configuration
- 每个 property test 运行 100+ 次迭代
- 使用 fast-check 的 `fc.assert` 和 `fc.property`
- 测试标签格式: `Feature: membership-points-phase1, Property N: {description}`
