## Context

Fluxa 是一个 AI 对话驱动的设计平台，用户通过自然语言生成画布设计。当前所有创作内容封闭在个人项目中，平台缺少内容消费侧和社区互动能力。现有数据模型以 `projects → documents → conversations → messages → ops` 为核心链路，所有表通过 RLS 隔离为用户私有。存储使用 Supabase Storage 的 `assets` bucket，路径格式 `{userId}/{projectId}/{assetId}.{ext}`。前端使用 Next.js App Router，路由统一在 `/app/` 下，UI 基于 shadcn/ui + Tailwind，状态管理用 Zustand，实时同步用 Supabase Realtime。

## Goals / Non-Goals

**Goals:**
- 用户可从编辑器发布对话 + 设计作品到公开社区
- 发布时创建对话快照，与原对话解耦
- 瀑布流画廊展示公开作品，支持分类、搜索、排序
- 作品详情页展示封面 + 完整对话回放（提示词 + AI 回复 + 设计产出）
- 完整社交互动：点赞、收藏、评论（含回复）、浏览量
- 创作者公开主页 + 关注/粉丝系统
- 所有新 UI 覆盖 zh-CN / en-US 双语

**Non-Goals:**
- 内容审核系统（首版依赖人工 / 举报，不做自动审核）
- 推荐算法（首版按时间和热度排序，不做个性化推荐）
- Fork 功能（用别人的对话重新生成）— 留给 Phase 3
- 对话链接私密分享 / 分享图片卡片 — 留给 Phase 3
- SEO 优化（公开画廊的 SSR / meta tags）— 后续迭代
- 管理后台（编辑推荐、精选集）— 后续迭代

## Decisions

### D1: 对话快照策略 — 发布时深拷贝

**选择**: 发布时将 messages + ops + canvas_state 完整复制到 `publication_snapshots` 表的 JSONB 字段中。

**备选方案**:
- A) 直接引用原 conversations/messages/ops 表 → 原对话修改会影响已发布内容，且需要突破 RLS 让其他用户读取私有数据
- B) 创建只读副本到独立表 → 表结构膨胀，维护成本高

**理由**: JSONB 快照方案最简单，与现有 RLS 完全解耦，发布后内容不可变。单个对话的 messages + ops 数据量通常在几十 KB 到几百 KB 之间，JSONB 存储完全可承受。缺点是无法对快照内容做关系查询，但这个场景不需要。

### D2: 封面图处理 — 复用 assets bucket + 新建 public bucket

**选择**: 封面图存储到新的 `public-assets` bucket（公开读），路径格式 `covers/{publicationId}.{ext}`。

**备选方案**:
- A) 复用现有 `assets` bucket → 该 bucket 是 private 的，需要 signed URL，画廊列表页加载几十张图会产生大量签名请求
- B) 将 assets bucket 改为 public → 会暴露所有用户的私有资产

**理由**: 画廊场景需要高效加载大量封面图，公开 bucket 可直接通过 URL 访问，无需签名。用独立 bucket 隔离公开资产和私有资产，安全边界清晰。上传时由服务端（Edge Function 或 RPC）处理，前端不直接操作 public bucket。

### D3: 浏览量计数 — 异步 RPC + 防刷

**选择**: 通过 Supabase RPC `increment_view_count` 异步更新，服务端做基本防刷（同一用户 + 同一作品 10 分钟内不重复计数）。

**备选方案**:
- A) 前端直接 UPDATE → 并发冲突，无法防刷
- B) 独立 analytics 服务 → 过度设计

**理由**: RPC 封装原子递增 + 防刷逻辑，简单可靠。初期不需要精确到秒的实时浏览量，最终一致即可。

### D4: 评论系统 — 单表 + parent_id 自引用

**选择**: 单个 `publication_comments` 表，通过 `parent_id` 实现一层回复（不支持深层嵌套）。

**备选方案**:
- A) 独立回复表 → 增加 JOIN 复杂度
- B) 支持无限嵌套 → 前端渲染和查询都复杂

**理由**: 一层回复覆盖绝大多数社区互动场景，简化查询（只需一次 fetch + 前端分组）。Instagram / 小红书也是这种模式。

### D5: 分类体系 — 数据库驱动 + 未来可扩展 AI 自动分类

**选择**: `publication_categories` 配置表 + 发布时手动选择分类。预置 8 个分类，可后台动态增删。

**备选方案**:
- A) 前端硬编码分类 → 不灵活
- B) 首版就做 AI 自动分类 → 增加复杂度和成本

**理由**: 配置表方案灵活且简单。表结构预留 `slug` 和 `sort_order` 方便前端使用和排序。未来加 AI 自动分类只需在发布流程中调用一次 LLM，不影响现有架构。

### D6: 关注系统 — user_follows 表 + 计数冗余

**选择**: `user_follows` 表记录关注关系，`user_profiles` 表冗余 `follower_count` 和 `following_count`。通过数据库触发器保持计数同步。

**理由**: 冗余计数避免每次展示创作者卡片时 COUNT 查询。触发器保证一致性，比应用层双写更可靠。

### D7: 前端路由和导航

**选择**: 
- 灵感发现入口放在左侧导航栏（在 Home 和 Projects 之间），图标用 `Compass`
- 新增路由: `/app/discover`, `/app/discover/[id]`, `/app/user/[id]`
- 我的发布/收藏整合到现有 profile 页面，不单独建路由

**理由**: 灵感发现是高频入口，放在一级导航最合适。个人发布和收藏属于用户资料的子模块，集成到 profile 更自然。

### D8: 对话回放组件 — 只读模式的 ChatMessage 复用

**选择**: 复用现有 `ChatMessage` 组件，新增 `readonly` 模式，从快照 JSON 渲染消息列表。不渲染画布，只展示文本 + 图片。

**备选方案**:
- A) 完整重建一个回放组件 → 代码重复
- B) 在详情页嵌入只读画布回放 ops → 太重，加载慢

**理由**: 对话回放的核心价值是展示"提示词 → AI 回复 → 生成的图片"过程，文本 + 图片已经足够。画布回放是好功能但复杂度过高，留给后续。

### D9: 画廊分页 — cursor-based 无限滚动

**选择**: 使用 cursor-based 分页（基于 `published_at` + `id`），前端 Intersection Observer 触发加载更多。

**理由**: 瀑布流场景下 offset-based 分页有数据漂移问题（新发布的内容会导致翻页重复）。cursor-based 分页天然适合无限滚动，且 Supabase 支持良好。

### D10: 发布流程数据流

```
编辑器 → 点击分享 → 弹出 ShareDialog
  → 选择「发布对话」→ 弹出 PublishForm
    → 自动提取对话中的图片作为封面候选
    → 用户选封面 + 填标题 + 选分类
    → 提交 → 调用 Supabase RPC `publish_conversation`
      → 服务端:
        1. 查询 messages + ops + canvas_state
        2. 封面图复制到 public-assets bucket
        3. INSERT publication + snapshot（事务）
        4. 返回 publication_id
    → 前端跳转或提示发布成功
```

## Risks / Trade-offs

**[快照数据量增长]** → 单个快照几十到几百 KB，百万级发布后约 100GB-1TB。Mitigation: JSONB 压缩 + 定期归档冷数据 + 分区表（远期）。

**[公开 bucket 安全]** → 封面图公开可访问，可能被盗链。Mitigation: 首版接受此风险；后续可加 CDN + referer 限制 + 水印。

**[RLS 性能]** → 画廊查询不需要 RLS（公开数据），但 Supabase 默认开启。Mitigation: 画廊查询通过 RPC 或 view 封装，使用 `SECURITY DEFINER` 函数绕过 RLS 读取公开数据，避免每行检查。

**[评论滥用]** → 公开评论可能被滥用。Mitigation: 首版限制登录用户才能评论 + 作者可删除自己作品下的评论；后续加举报 + 敏感词过滤。

**[计数器并发]** → 高并发点赞/浏览可能导致计数不准。Mitigation: 使用 `UPDATE ... SET count = count + 1`（原子操作），不用 SELECT + UPDATE 模式。触发器也可保证事务内一致。

**[快照不可变 vs 用户想更新]** → 发布后用户可能想更新内容。Mitigation: 支持"重新发布"操作——生成新快照覆盖旧快照，保留 publication_id 和社交数据。

## Open Questions

1. **封面图尺寸规范**: 是否需要服务端裁剪/缩放？建议首版前端限制上传尺寸 + 显示时 CSS 裁剪，后续按需加服务端处理。
2. **发布后是否支持编辑标题/分类**: 建议支持，只需 UPDATE publication 元数据，不影响快照。
3. **是否需要「取消发布」**: 建议支持——将 status 改为 `hidden`，画廊不展示但数据保留。
4. **点赞/收藏是否需要 Realtime 订阅**: 首版建议不需要，操作后前端乐观更新即可。
