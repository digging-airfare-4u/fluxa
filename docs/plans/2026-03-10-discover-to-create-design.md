# Discover → Create 创作转化设计

## 背景

当前 Fluxa 已具备：
- 发现流浏览能力（搜索/分类/排序/无限滚动）
- 首页灵感区与作品卡片复用
- 新建项目并携带 prompt 进入编辑器的基础链路

现阶段目标从“浏览效率”进一步升级为“创作转化效率”：让用户从看到灵感到开始创作的路径更短、更顺滑。

## 目标

将主路径优化为：

**浏览灵感 → 一键复刻/二创 → 自动进入编辑器生成首稿**

核心业务目标：
1. 提升 Discover 到编辑器的转化率
2. 提升首次生成触发率
3. 提升首次生成后的继续编辑率

## 方案对比

### 方案 A（推荐）：一键复刻直达编辑器
- 在 Discover 卡片与详情页新增 `复刻同款` CTA
- 点击后创建项目并注入灵感 prompt

优点：改动小、验证快、风险低。
缺点：prompt 质量直接影响感知效果。

### 方案 B：结构化模板拼装
- 为每条灵感增加可编辑结构字段（风格/主体/镜头/色调）
- 用户勾选后拼接 prompt

优点：可控性更高。
缺点：数据结构与 UI 成本中等。

### 方案 C：收藏后批量创作
- 先收藏，再在收藏页合成创作 brief

优点：适合深度用户。
缺点：首次转化路径更长。

**结论：先落地方案 A，验证后再演进 B。**

## 已确认决策

- 优先目标：创作导向（用户选择）
- 入口位置：卡片 + 详情页都放（用户选择）

## 信息架构与交互

### 入口
1. `src/components/discover/PublicationCard.tsx`
   - 新增 CTA：`复刻同款`
2. `src/app/app/discover/[id]/page.tsx`
   - 新增 CTA：`复刻同款`
   - 可选同入口扩展文案：`基于此二创`

### 主链路
1. 用户点击 CTA
2. 前端调用 `createProject()`
3. 组装 `inspirationPrompt`
4. 跳转：`/app/p/{projectId}?prompt=...&source=discover&entry={card|detail}&ref={publicationId}`
5. 编辑器自动启动首次生成（沿用现有 prompt 注入机制）

## 数据与参数契约

### 输入数据（publication）
- `id`
- `title`
- `category_name`（若有）
- `tags`（若有）
- `description`（若有）
- `image_url`（若有）

### Prompt 组装优先级
1. 标题（强信号）
2. 分类 + tags（风格信号）
3. 描述（内容信号）
4. 附加指令（保持风格一致且可继续编辑）

### 长度控制
- 对 prompt 做长度上限（建议 500~800 字符）
- 超长时保留高优先级字段并截断

## 失败兜底

1. `createProject` 失败
   - 提示错误
   - 停留当前页面
2. prompt 构建失败
   - 回退到通用 prompt
3. publication 字段缺失
   - 用已有字段最小拼接

## 事件埋点（MVP 最小集）

- `discover_remix_click`（维度：entry=card/detail）
- `discover_remix_project_created`
- `discover_remix_first_generation_started`

## 验收标准

1. 卡片与详情页都能触发复刻入口
2. 点击后成功创建项目并带 prompt 跳转到编辑器
3. 异常情况下有可感知提示且不破坏当前浏览
4. 埋点可区分 card/detail 来源

## 非目标（本轮不做）

- 不改推荐算法
- 不重构 Discover 主架构
- 不引入复杂模板系统

## 迭代路线

- **MVP v1**：卡片+详情页 CTA、项目创建跳转、基础埋点
- **v1.1**：按分类优化 prompt 模板
- **v1.2**：加入“二创模式”参数化控制（保主体改风格等）
