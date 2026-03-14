# Discover 浏览效率优化（灵感流逛型）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不重构后端推荐链路的前提下，优化发现页为“先逛后筛”的体验，提高浏览深度、卡片点击率与收藏互动。

**Architecture:** 先做前端信息架构与交互重排（Discover 页面 + PublicationCard），保留现有 `fetchGalleryPublications` 与 infinite scroll 主流程；通过 URL 参数继续驱动筛选状态。采用契约测试先行（Vitest 读取源码断言）保证结构和关键行为稳定，再最小实现通过测试。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, next-intl, Vitest

---

### Task 1: 为 Discover 页面新增契约测试（首屏逛流结构 + 筛选可见状态）

**Files:**
- Create: `tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
- Modify: `src/app/app/discover/page.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery Discover browsing contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );

  it('renders inspiration-first section before masonry list', () => {
    expect(source).toContain('discover.inspiration_today');
    expect(source).toContain('featuredPublications');
    expect(source).toContain('overflow-x-auto');
  });

  it('supports collapsible filter panel and active filter chips', () => {
    expect(source).toContain('isFiltersOpen');
    expect(source).toContain('discover.filters');
    expect(source).toContain('discover.clear_all_filters');
    expect(source).toContain('activeFilterChips');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
Expected: FAIL with missing identifiers/translation keys not yet present in `src/app/app/discover/page.tsx`

**Step 3: Write minimal implementation**

在 `src/app/app/discover/page.tsx` 做最小改动：
- 添加 `featuredPublications`（可由 `publications.slice(0, 10)` 得到）
- 在 masonry 前新增「今日灵感」横滑区
- 增加 `isFiltersOpen` 状态与折叠筛选容器
- 增加 `activeFilterChips` 派生数组与清空操作

示例最小代码片段：

```ts
const [isFiltersOpen, setIsFiltersOpen] = useState(false);
const featuredPublications = publications.slice(0, 10);

const activeFilterChips = [
  search ? { key: 'q', label: `Q: ${search}` } : null,
  categorySlug ? { key: 'category', label: categorySlug } : null,
  sortBy !== 'latest' ? { key: 'sort', label: sortBy } : null,
].filter(Boolean);
```

```tsx
<section className="pt-2">
  <h2 className="text-sm font-semibold mb-2">{t('discover.inspiration_today')}</h2>
  <div className="flex gap-3 overflow-x-auto pb-2">
    {featuredPublications.map((pub) => (
      <div key={pub.id} className="w-56 shrink-0">
        <PublicationCard publication={pub} />
      </div>
    ))}
  </div>
</section>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/discover-page-browsing-contract.test.ts src/app/app/discover/page.tsx
git commit -m "feat: add inspiration-first discover layout contract"
```

---

### Task 2: 为 PublicationCard 新增信息密度与标签展示契约测试

**Files:**
- Modify: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Modify: `src/components/discover/PublicationCard.tsx`

**Step 1: Write the failing test**

在现有测试中追加断言：

```ts
it('shows richer browsing metadata and compact tags', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
    'utf8'
  );

  expect(source).toContain('line-clamp-2');
  expect(source).toContain('publication.bookmark_count');
  expect(source).toContain('publication.category_name');
  expect(source).toContain('publication.tags.slice(0, 2)');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: FAIL for missing class/fields/snippets

**Step 3: Write minimal implementation**

在 `src/components/discover/PublicationCard.tsx`：
- 标题 `line-clamp-1` 改为 `line-clamp-2`
- 展示 category chip + 最多 2 个 tag
- 保持当前 Like/Bookmark 结构不拆分，只补充轻量信息

示例片段：

```tsx
<h3 className="text-sm font-medium text-foreground line-clamp-2">{publication.title}</h3>

<div className="flex flex-wrap gap-1">
  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{publication.category_name}</span>
  {publication.tags.slice(0, 2).map((tag) => (
    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70">#{tag}</span>
  ))}
</div>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-card-contract.test.ts src/components/discover/PublicationCard.tsx
git commit -m "feat: enrich publication card metadata for browsing"
```

---

### Task 3: 增加分享入口链接行为契约测试（已发布复制作品页链接）

**Files:**
- Create: `tests/inspiration-discovery/share-dialog-link-contract.test.ts`
- Modify: `src/components/share/ShareDialog.tsx`
- Modify: `src/components/share/PublishForm.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery ShareDialog link contract', () => {
  const dialog = readFileSync(resolve(process.cwd(), 'src/components/share/ShareDialog.tsx'), 'utf8');
  const form = readFileSync(resolve(process.cwd(), 'src/components/share/PublishForm.tsx'), 'utf8');

  it('supports published id callback and detail-link copy', () => {
    expect(dialog).toContain('publishedPublicationId');
    expect(dialog).toContain('/app/discover/${publishedPublicationId}');
    expect(form).toContain('onSuccess?: (id: string) => void');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/share-dialog-link-contract.test.ts`
Expected: FAIL because ShareDialog does not yet hold publication id for copy-link

**Step 3: Write minimal implementation**

- `ShareDialog.tsx` 增加 `publishedPublicationId` 状态
- `PublishForm onSuccess` 回传 id 后保存到 `publishedPublicationId`
- `handleCopyLink` 按是否有 id 复制 detail 或 discover 链接

示例片段：

```ts
const [publishedPublicationId, setPublishedPublicationId] = useState<string | null>(null);

const handleCopyLink = () => {
  const path = publishedPublicationId ? `/app/discover/${publishedPublicationId}` : '/app/discover';
  navigator.clipboard.writeText(`${window.location.origin}${path}`);
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/share-dialog-link-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/share-dialog-link-contract.test.ts src/components/share/ShareDialog.tsx src/components/share/PublishForm.tsx
git commit -m "fix: copy publication detail link after successful publish"
```

---

### Task 4: 补充文案键并确保发现页/分享文案可渲染

**Files:**
- Modify: `src/locales/zh-CN/common.json`
- Modify: `src/locales/en-US/common.json`
- Test: `tests/inspiration-discovery/discover-page-browsing-contract.test.ts`

**Step 1: Write the failing test**

在 `discover-page-browsing-contract.test.ts` 增加字符串键断言：

```ts
it('references translation keys for browsing-first controls', () => {
  expect(source).toContain("t('discover.inspiration_today')");
  expect(source).toContain("t('discover.filters')");
  expect(source).toContain("t('discover.clear_all_filters')");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
Expected: FAIL if key references missing

**Step 3: Write minimal implementation**

在中英文 `common.json` 的 `discover` 节点补充：

```json
{
  "inspiration_today": "今日灵感",
  "filters": "筛选",
  "clear_all_filters": "清空筛选"
}
```

英文对应：

```json
{
  "inspiration_today": "Inspiration Today",
  "filters": "Filters",
  "clear_all_filters": "Clear filters"
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/locales/zh-CN/common.json src/locales/en-US/common.json tests/inspiration-discovery/discover-page-browsing-contract.test.ts
git commit -m "chore: add discover browsing i18n keys"
```

---

### Task 5: 回归验证（发现页与分享关键契约）

**Files:**
- Test: `tests/inspiration-discovery/discover-page-browsing-contract.test.ts`
- Test: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Test: `tests/inspiration-discovery/share-dialog-link-contract.test.ts`
- Test: `tests/inspiration-discovery/publish-form-contract.test.ts`

**Step 1: Write the failing test**

此任务不新增测试文件；执行全量相关契约作为回归门槛。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/share-dialog-link-contract.test.ts tests/inspiration-discovery/publish-form-contract.test.ts`
Expected: 如果前序任务未完成将 FAIL；全部完成后应可 PASS

**Step 3: Write minimal implementation**

若回归失败，仅做最小修复，不引入额外功能；禁止扩大范围到推荐算法或后端 schema 变更。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-page-browsing-contract.test.ts tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/share-dialog-link-contract.test.ts tests/inspiration-discovery/publish-form-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/*.test.ts src/app/app/discover/page.tsx src/components/discover/PublicationCard.tsx src/components/share/ShareDialog.tsx src/components/share/PublishForm.tsx src/locales/en-US/common.json src/locales/zh-CN/common.json
git commit -m "test: lock discover browsing and share link contracts"
```

---

## Non-Goals（本轮不做）

- 不引入新的 Supabase 推荐 RPC 或排序权重模型
- 不改 discover 详情页信息架构
- 不做全屏卡流形态改造

## Verification Checklist

- Discover 首屏优先展示灵感内容区
- 筛选区可折叠，且 active filters 可见并可清空
- PublicationCard 支持更高信息密度且不破坏跳转
- 发布成功后复制链接优先指向作品详情页
- 契约测试全部通过
