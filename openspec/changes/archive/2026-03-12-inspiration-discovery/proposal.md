## Why

Fluxa 的核心体验（AI 对话生成设计 + 画布编辑）已经上线，但用户创作的作品目前只能停留在个人项目中，缺乏展示、分享和社区互动的渠道。平台没有内容消费侧，新用户进入后看不到"这个平台能做出什么"，导致冷启动困难、留存不足。引入灵感发现社区可以：1) 展示平台 AI 设计能力，降低新用户认知门槛；2) 通过分享 → 反馈 → 创作的飞轮驱动用户留存；3) 对话过程公开共享形成 Fluxa 的独特差异化（不只是看成品，还能看到 AI 对话全过程）。

## What Changes

- 新增「发布对话」功能：用户可从编辑器将对话 + 画布设计发布到公开社区，发布时选择封面图、标题、分类
- 新增「灵感发现」页面：瀑布流画廊展示所有公开发布的作品，支持分类标签筛选和搜索
- 新增「作品详情」页面：展示封面大图 + 完整对话回放（提示词 + AI 回复 + 设计产出），用户可学习他人的提示词技巧
- 新增社交互动：点赞、收藏、评论（支持回复）、浏览量统计
- 新增关注系统：关注其他创作者，在个人主页查看其发布作品
- 新增创作者公开主页：展示个人信息、发布作品列表、粉丝/关注数
- 新增「我的发布」和「我的收藏」管理页面
- 发布时创建对话快照，确保原对话后续修改不影响已发布内容

## Capabilities

### New Capabilities
- `publication-system`: 发布作品的核心能力——创建/管理/下架发布，对话快照机制，封面图处理，分类与标签
- `discovery-gallery`: 灵感发现画廊——瀑布流展示、分类标签筛选、搜索、排序（最新/最热/推荐）
- `publication-detail`: 作品详情页——封面展示、完整对话回放、提示词展示、创作者信息
- `social-interactions`: 社交互动——点赞、收藏、评论（含回复）、浏览量计数
- `creator-profiles`: 创作者体系——公开主页、关注/粉丝、个人作品列表、个人信息编辑
- `share-dialog`: 编辑器内分享入口——分享弹窗（复制链接/分享图片/发布对话）、发布表单

### Modified Capabilities
<!-- No existing spec-level requirement changes -->

## Impact

- **数据库**: 新增 6-8 张表（publications, publication_snapshots, publication_categories, publication_likes, publication_bookmarks, publication_comments, user_follows），扩展 user_profiles 增加公开资料字段
- **RLS**: 所有新表需配置行级安全策略——发布作品公开可读、互动操作需登录、管理操作限本人
- **存储**: 封面图存储到 assets bucket，需新增 publication covers 的存储路径和策略
- **前端路由**: 新增 `/app/discover`、`/app/discover/[id]`、`/app/user/[id]`、`/app/profile/publications`、`/app/profile/bookmarks`
- **组件**: 新增发布弹窗、画廊网格、作品卡片、对话回放、评论区、创作者卡片等 15+ 组件
- **API**: 新增发布、互动、搜索相关的 API 端点或 Supabase RPC
- **现有代码**: 编辑器顶部工具栏新增分享按钮；用户个人资料页扩展发布/收藏入口；左侧导航新增灵感发现入口
- **i18n**: 所有新增 UI 文案需覆盖 zh-CN 和 en-US
