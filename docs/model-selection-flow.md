# 模型选择流程

## 概述

Fluxa 的模型选择功能支持两类模型：
- **系统模型**：预置的 AI 模型（如 Doubao Seedream），使用点数计费
- **用户配置模型 (BYOK)**：用户自行配置的第三方 API（如 OpenAI 兼容接口），免费使用

## 数据来源

| 来源 | 说明 | 获取方式 |
|------|------|----------|
| **系统模型** | 预置的 AI 模型 | 从 Supabase `ai_models` 表读取 |
| **用户配置模型 (BYOK)** | 用户配置的第三方 API | 从 `/api/provider-configs` 获取 |

## 核心文件

```
src/
├── lib/
│   ├── models/
│   │   ├── index.ts                           # 导出入口
│   │   ├── model-identifier.ts                # 模型标识工具函数
│   │   └── resolve-selectable-models.ts       # 合并系统模型和用户配置的逻辑
│   ├── api/
│   │   └── provider-configs.ts                # 用户配置 API 客户端
│   ├── supabase/
│   │   └── queries/
│   │       └── models.ts                      # 系统模型查询函数
│   └── store/
│       └── useChatStore.ts                    # Zustand 状态管理
└── components/
    └── chat/
        └── ModelSelector.tsx                  # 模型选择器 UI 组件
```

## 模型标识规则

系统通过不同的标识格式区分模型类型：

```typescript
// 系统模型：直接使用 model_name
'doubao-seedream-4-5-251128'

// 用户模型：使用 user:{configId} 格式
'user:abc-123'
```

相关工具函数定义在 `model-identifier.ts`：

```typescript
// 判断是否是用户模型
isUserModelIdentifier(value: string): boolean

// 从 configId 构建用户模型标识
toUserModelIdentifier(configId: string): UserModelIdentifier

// 从用户模型标识解析出 configId
parseUserModelConfigId(value: string): string | null
```

## 选择器组件流程

`ModelSelector.tsx` 组件的处理流程：

```
用户点击模型按钮
       ↓
┌─────────────────────────────────────────┐
│  并行加载数据                            │
│  - fetchModels() → 系统模型列表          │
│  - fetchUserProviderConfigs() → 用户配置 │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│  resolveSelectableModels()              │
│  合并成 SelectableModel[] 统一列表       │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│  按 type 分组展示                        │
│  - image: 图像生成模型（带图片图标）      │
│  - ops: 文本/操作模型（带对话图标）      │
└─────────────────────────────────────────┘
       ↓
用户选择 → onModelChange(modelValue)
```

## 核心类型定义

### SelectableModel

```typescript
interface SelectableModel {
  /** 传给生成 API 的值 */
  value: string;
  /** 显示名称 */
  displayName: string;
  /** 模型类型 */
  type: 'image' | 'ops';
  /** 是否是用户配置的 BYOK 模型 */
  isByok: boolean;
  /** 消耗点数（BYOK 模型为 0） */
  pointsCost: number;
  /** 描述信息 */
  description?: string | null;
  /** 是否是系统默认模型 */
  isDefault: boolean;
  /** 提供商名称 */
  provider: string;
}
```

### UserProviderConfig

```typescript
interface UserProviderConfig {
  id: string;
  user_id: string;
  provider: string;           // 'volcengine' | 'openai-compatible'
  api_url: string;
  model_name: string;
  display_name: string;
  is_enabled: boolean;
  api_key_masked: string;     // 脱敏后的 API Key
  model_identifier: string;    // 'user:{id}' 格式
}
```

## 状态管理

使用 Zustand 的 `useChatStore` 管理模型相关状态：

```typescript
// 状态
selectedModel: string                    // 当前选中的模型值
selectableModels: SelectableModel[]      // 合并后的可选模型列表

// Actions
setSelectedModel(model: string)          // 更新选中模型
setSelectableModels(models)              // 更新可选模型列表（自动处理默认模型）
```

### 默认模型逻辑

当 `setSelectableModels` 更新可选模型时：
1. 查找 `isDefault: true` 的模型作为默认
2. 如果当前选中的模型不在新列表中，自动切换到默认模型
3. 如果当前选中的模型仍在列表中，保持不变

## 数据流图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ModelSelector 组件                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  useEffect → loadModels()                                           │
│       │                                                              │
│       ↓                                                              │
│  ┌─────────────────────────────┐    ┌────────────────────────────┐ │
│  │   fetchModels()             │    │ fetchUserProviderConfigs() │ │
│  │   (Supabase: ai_models)   │    │ (/api/provider-configs)    │ │
│  │   返回 AIModel[]           │    │ 返回 UserProviderConfig[]  │ │
│  └─────────────┬───────────────┘    └──────────────┬─────────────┘ │
│                │                                     │              │
│                └──────────────┬──────────────────────┘              │
│                               ↓                                      │
│              resolveSelectableModels()                               │
│              ┌─────────────────────────────────────┐                │
│              │ • 系统模型 → SelectableModel        │                │
│              │ • 用户配置 → SelectableModel        │                │
│              │ • 只包含 enabled 的用户配置          │                │
│              │ • BYOK 模型 type 强制为 'image'      │                │
│              └─────────────────────────────────────┘                │
│                               ↓                                      │
│              setSelectableModels(models)                            │
│                               ↓                                      │
│              按 type 分组渲染 DropdownMenu                           │
│              - imageModels: 图像生成                                 │
│              - opsModels: 文本生成                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        useChatStore                                  │
├─────────────────────────────────────────────────────────────────────┤
│  selectedModel: 'doubao-seedream-4-5-251128'                        │
│                                                                      │
│  用户点击选择 → onModelChange(value) → setSelectedModel(value)      │
│                                                                      │
│  生成图片时:                                                          │
│  generation API(selectedModel, prompt, ...)                          │
└─────────────────────────────────────────────────────────────────────┘
```

## 费用说明

| 模型类型 | 计费方式 |
|----------|----------|
| 系统模型 | 消耗点数 (`pointsCost`) |
| BYOK 模型 | 免费 (`pointsCost: 0`) |

## 用户配置入口

### 入口位置

用户在**主页右上角的齿轮图标 (Settings)** 中配置自定义模型：

```
主页 (/) → 点击右上角齿轮图标 → ProviderConfigPanel 弹窗
```

### 功能开关

该功能受 Feature Flag 控制：
- **数据库**: `system_settings` 表中 `model_config_enabled` 为 `true`
- **环境变量**: `NEXT_PUBLIC_MODEL_CONFIG_ENABLED` (构建时回退)
- **默认**: `false` (功能关闭)

### ProviderConfigPanel

`src/components/settings/ProviderConfigPanel.tsx` 提供的功能：

| 功能 | 说明 |
|------|------|
| 查看配置列表 | 显示所有已配置的 BYOK 模型 |
| 新增配置 | 添加新的第三方 API 配置 |
| 编辑配置 | 修改现有配置 |
| 删除配置 | 移除配置 |
| 测试连接 | 验证 API 配置是否可用 |
| 启用/禁用 | 切换配置是否在模型选择器中显示 |

### 支持的 Provider 类型

```typescript
type ProviderType = 'volcengine' | 'openai-compatible';
```

## 相关需求

- Requirement 5.1, 6.5: 用户模型标识解析
- Requirement 6.1-6.5: 模型选择器与可选择模型
- Requirement 6.6: 模型类型区分（image / ops）
- Requirement 2.4-2.6, 6.5: 用户配置 CRUD
- Requirement 4.3-4.5, 4.8: Provider 连接测试
- Requirement 7.2-7.3: 启用/禁用配置
