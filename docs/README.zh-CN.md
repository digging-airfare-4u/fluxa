# Fluxa

AI 驱动的设计生成平台，通过自然语言对话创建视觉设计。

[English](../README.md)

## 功能特性

- **对话式设计** - 在聊天中描述设计需求，AI 自动生成画布操作
- **Ops 驱动架构** - 所有画布变更都是离散的、可回放的操作
- **实时画布** - 基于 Fabric.js 的无限画布，支持平移/缩放
- **项目管理** - 多项目支持，包含文档和对话
- **资源管理** - 上传、AI 生成和导出图片
- **会员积分** - 基于使用量的积分系统

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router), React 19, TypeScript |
| 样式 | Tailwind CSS 4, shadcn/ui, Radix UI |
| 画布 | Fabric.js 7 |
| 后端 | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| 状态管理 | Zustand |
| 校验 | AJV |
| 测试 | Vitest, fast-check |

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 10+
- Supabase 账号

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/fluxa.git
cd fluxa

# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env
```

### 环境变量

在 `.env` 中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的_turnstile_site_key
```

AI API 密钥在 Supabase Edge Function Secrets 中配置（Dashboard > Edge Functions > Secrets）。

### 开发

```bash
# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 监听模式运行测试
pnpm test:watch

# 生产构建
pnpm build
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── app/               # 主应用路由（需认证）
│   └── auth/              # 认证页面
├── components/
│   ├── canvas/            # 画布组件 (CanvasStage, ContextMenu)
│   ├── chat/              # 聊天面板组件
│   ├── editor/            # 编辑器布局组件
│   ├── home/              # 首页组件
│   ├── points/            # 积分/会员组件
│   └── ui/                # shadcn/ui 组件
├── lib/
│   ├── canvas/            # Ops 类型和执行器
│   ├── realtime/          # Supabase Realtime 订阅
│   ├── selection/         # 选择状态管理
│   ├── store/             # Zustand stores
│   └── supabase/          # Supabase 客户端和查询
└── ai/
    └── schema/            # AI ops 的 JSON Schema 校验

supabase/
├── functions/             # Edge Functions (Deno)
│   ├── generate-ops/      # AI ops 生成
│   └── generate-image/    # AI 图片生成
└── *.sql                  # 数据库 schema 和迁移

tests/                     # Vitest 测试文件
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      EditorLayout                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CanvasStage (Fabric.js)  │  ChatPanel                  ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Ops Engine                            ││
│  │  - createFrame, setBackground, addText, addImage        ││
│  │  - updateLayer, removeLayer                             ││
│  └─────────────────────────┬───────────────────────────────┘│
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase 后端                             │
│  PostgreSQL │ Auth │ Realtime │ Storage │ Edge Functions    │
└─────────────────────────────────────────────────────────────┘
```

## 用户流程

1. 用户从首页创建项目（可选择输入初始提示词）
2. 项目在编辑器中打开，包含画布和聊天面板
3. 用户在聊天中描述设计 → AI 生成 ops → ops 在画布上执行
4. 用户可以手动编辑、导出，或继续通过聊天迭代

## Ops 类型

| Op 类型 | 描述 |
|---------|------|
| `createFrame` | 创建画布框架，设置尺寸 |
| `setBackground` | 设置背景（纯色/渐变/图片） |
| `addText` | 添加文本图层 |
| `addImage` | 添加图片图层 |
| `updateLayer` | 更新图层属性 |
| `removeLayer` | 删除图层 |

## 许可证

MIT
