# Discover to Create Remix Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-click “remix” flow on Discover cards and publication detail so users can create a new project and jump straight into the editor with an inspiration prompt.

**Architecture:** Introduce a small client-safe remix utility (`buildRemixPrompt` + `buildRemixEditorUrl`) and wire it into two entry points: Discover gallery cards (`entry=card`) and publication detail (`entry=detail`). Keep existing project creation and editor prompt bootstrapping unchanged (`createProject` + `?prompt=` query), and add lightweight event logging for funnel measurement.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, Vitest, Sonner

---

### Task 1: Add contract tests for remix entrypoints and URL parameters

**Files:**
- Create: `tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/app/app/discover/[id]/page.tsx`
- Modify: `src/components/discover/PublicationCard.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery remix entry contract', () => {
  const discoverPage = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );
  const detailPage = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/[id]/page.tsx'),
    'utf8'
  );
  const card = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
    'utf8'
  );

  it('wires remix action on discover cards', () => {
    expect(discoverPage).toContain('entry: \"card\"');
    expect(discoverPage).toContain('onRemix');
    expect(card).toContain("t('discover.remix_cta')");
  });

  it('wires remix action on publication detail', () => {
    expect(detailPage).toContain('entry: \"detail\"');
    expect(detailPage).toContain("t('discover.remix_cta')");
  });

  it('passes source/ref metadata to editor route', () => {
    expect(discoverPage).toContain('source=discover');
    expect(discoverPage).toContain('ref=');
    expect(detailPage).toContain('source=discover');
    expect(detailPage).toContain('ref=');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: FAIL (missing remix strings and props in current files)

**Step 3: Write minimal implementation stubs**

Add placeholder identifiers in target files (without full logic yet):
- Discover page: planned `entry: "card"` handler location
- Detail page: planned `entry: "detail"` handler location
- Card component: planned remix button translation usage

**Step 4: Run test to verify it passes (or partially passes before Task 3/4)**

Run: `pnpm test -- tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: PASS after Task 3 + Task 4 complete (it is acceptable if still failing now; keep as red/green guardrail)

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/discover-remix-entry-contract.test.ts src/app/app/discover/page.tsx src/app/app/discover/[id]/page.tsx src/components/discover/PublicationCard.tsx
git commit -m "test: add discover remix entrypoint contract"
```

---

### Task 2: Implement remix prompt and editor URL builder with unit tests

**Files:**
- Create: `src/lib/inspiration/remix.ts`
- Create: `tests/inspiration-discovery/remix-utils.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildRemixPrompt, buildRemixEditorUrl } from '@/lib/inspiration/remix';

describe('inspiration remix utils', () => {
  it('builds prompt from title/category/tags/description', () => {
    const prompt = buildRemixPrompt({
      title: 'Neon city poster',
      categoryName: 'Poster',
      tags: ['neon', 'cyberpunk'],
      description: 'High contrast night city scene',
    });

    expect(prompt).toContain('Neon city poster');
    expect(prompt).toContain('Poster');
    expect(prompt).toContain('neon');
    expect(prompt).toContain('High contrast');
  });

  it('falls back to safe default prompt when fields are empty', () => {
    const prompt = buildRemixPrompt({
      title: '',
      categoryName: '',
      tags: [],
      description: '',
    });

    expect(prompt).toContain('Generate an editable version');
  });

  it('builds editor URL with source entry and ref', () => {
    const url = buildRemixEditorUrl({
      projectId: 'p_123',
      prompt: 'hello world',
      entry: 'card',
      publicationId: 'pub_1',
    });

    expect(url).toContain('/app/p/p_123?');
    expect(url).toContain('source=discover');
    expect(url).toContain('entry=card');
    expect(url).toContain('ref=pub_1');
    expect(url).toContain('prompt=');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/remix-utils.test.ts`
Expected: FAIL (module does not exist)

**Step 3: Write minimal implementation**

```ts
// src/lib/inspiration/remix.ts
export type RemixEntry = 'card' | 'detail';

interface BuildRemixPromptInput {
  title: string;
  categoryName?: string | null;
  tags?: string[] | null;
  description?: string | null;
  maxLength?: number;
}

interface BuildRemixEditorUrlInput {
  projectId: string;
  prompt: string;
  entry: RemixEntry;
  publicationId: string;
}

const FALLBACK_PROMPT =
  'Generate an editable version inspired by this work, preserving the overall style direction.';

export function buildRemixPrompt(input: BuildRemixPromptInput): string {
  const parts: string[] = [];

  if (input.title?.trim()) parts.push(`Title: ${input.title.trim()}`);
  if (input.categoryName?.trim()) parts.push(`Category: ${input.categoryName.trim()}`);
  if (input.tags?.length) parts.push(`Tags: ${input.tags.filter(Boolean).join(', ')}`);
  if (input.description?.trim()) parts.push(`Description: ${input.description.trim()}`);

  parts.push('Task: Keep the style direction but produce a fresh, editable variant.');

  const raw = parts.filter(Boolean).join('\n');
  const normalized = raw.trim().length > 0 ? raw : FALLBACK_PROMPT;
  const limit = input.maxLength ?? 700;

  return normalized.length > limit ? normalized.slice(0, limit) : normalized;
}

export function buildRemixEditorUrl(input: BuildRemixEditorUrlInput): string {
  const params = new URLSearchParams({
    prompt: input.prompt,
    source: 'discover',
    entry: input.entry,
    ref: input.publicationId,
  });

  return `/app/p/${input.projectId}?${params.toString()}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/remix-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/inspiration/remix.ts tests/inspiration-discovery/remix-utils.test.ts
git commit -m "feat: add discover remix prompt and route builders"
```

---

### Task 3: Add remix CTA to PublicationCard and wire Discover page card entry flow

**Files:**
- Modify: `src/components/discover/PublicationCard.tsx`
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/locales/zh-CN/common.json`
- Modify: `src/locales/en-US/common.json`
- Test: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Test: `tests/inspiration-discovery/discover-remix-entry-contract.test.ts`

**Step 1: Write the failing test**

Append to `tests/inspiration-discovery/publication-card-contract.test.ts`:

```ts
it('supports remix action trigger and i18n label', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
    'utf8'
  );

  expect(source).toContain('onRemix?:');
  expect(source).toContain("t('discover.remix_cta')");
  expect(source).toContain('entry: "card"');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

In `src/components/discover/PublicationCard.tsx`:
- Add props:
  - `onRemix?: () => void | Promise<void>`
  - `isRemixing?: boolean`
- Keep existing detail link behavior untouched
- Render remix button in footer area when `onRemix` is provided

Example snippet:

```tsx
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
  onRemix?: () => void | Promise<void>;
  isRemixing?: boolean;
}

const t = useTranslations('common');

{onRemix ? (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      void onRemix();
    }}
    className="h-8 px-2 rounded-md border text-xs inline-flex items-center gap-1"
    disabled={!!isRemixing}
  >
    <Sparkles className="size-3" />
    {t('discover.remix_cta')}
  </button>
) : null}
```

In `src/app/app/discover/page.tsx`:
- Import `createProject` and remix utils
- Add `remixingId` state
- Add `handleRemixFromCard(pub)` that:
  1. builds prompt (`buildRemixPrompt`)
  2. creates project (`createProject()`)
  3. routes to editor (`buildRemixEditorUrl(... entry: "card" ...)`)
  4. handles errors with `toast.error(...)`
- Pass props to card:

```tsx
<PublicationCard
  key={pub.id}
  publication={pub}
  onRemix={() => handleRemixFromCard(pub)}
  isRemixing={remixingId === pub.id}
/>
```

Add i18n keys:

```json
"discover": {
  "remix_cta": "复刻同款",
  "remix_failed": "创建复刻项目失败，请重试"
}
```

```json
"discover": {
  "remix_cta": "Remix this",
  "remix_failed": "Failed to create remix project. Please try again"
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/discover/PublicationCard.tsx src/app/app/discover/page.tsx src/locales/zh-CN/common.json src/locales/en-US/common.json tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/discover-remix-entry-contract.test.ts
git commit -m "feat: add discover card remix action"
```

---

### Task 4: Add remix CTA to publication detail page (detail entry flow)

**Files:**
- Modify: `src/app/app/discover/[id]/page.tsx`
- Test: `tests/inspiration-discovery/discover-remix-entry-contract.test.ts`

**Step 1: Write the failing test**

Append in `discover-remix-entry-contract.test.ts`:

```ts
it('renders detail remix action near detail interactions', () => {
  expect(detailPage).toContain('handleRemixFromDetail');
  expect(detailPage).toContain('entry: "detail"');
  expect(detailPage).toContain("t('discover.remix_cta')");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

In `src/app/app/discover/[id]/page.tsx`:
- Import `createProject`, remix utils, and `toast`
- Add `isRemixing` state
- Add handler:

```ts
const handleRemixFromDetail = async () => {
  if (!publication || isRemixing) return;

  try {
    setIsRemixing(true);
    const prompt = buildRemixPrompt({
      title: publication.title,
      categoryName: publication.category?.name,
      tags: publication.tags,
      description: publication.description,
    });
    const { project } = await createProject();
    const url = buildRemixEditorUrl({
      projectId: project.id,
      prompt,
      entry: 'detail',
      publicationId: publication.id,
    });
    router.push(url);
  } catch (error) {
    console.error('[PublicationDetail] Failed to remix:', error);
    toast.error(t('discover.remix_failed'));
  } finally {
    setIsRemixing(false);
  }
};
```

- Add button in action row next to like/bookmark:

```tsx
<Button variant="secondary" size="sm" onClick={handleRemixFromDetail} disabled={isRemixing}>
  {t('discover.remix_cta')}
</Button>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/app/discover/[id]/page.tsx tests/inspiration-discovery/discover-remix-entry-contract.test.ts
git commit -m "feat: add discover detail remix action"
```

---

### Task 5: Add lightweight remix funnel metrics and run full regression

**Files:**
- Create: `src/lib/observability/discover.ts`
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/app/app/discover/[id]/page.tsx`
- Test: `tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
- Test: `tests/inspiration-discovery/remix-utils.test.ts`
- Test: `tests/inspiration-discovery/publication-card-contract.test.ts`

**Step 1: Write the failing test**

Append in `discover-remix-entry-contract.test.ts`:

```ts
it('logs remix funnel events for click and project creation', () => {
  expect(discoverPage).toContain('discover_remix_click');
  expect(discoverPage).toContain('discover_remix_project_created');
  expect(detailPage).toContain('discover_remix_click');
  expect(detailPage).toContain('discover_remix_project_created');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-remix-entry-contract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/lib/observability/discover.ts`:

```ts
type RemixEntry = 'card' | 'detail';

export function trackDiscoverRemixEvent(event: 'discover_remix_click' | 'discover_remix_project_created', payload: { entry: RemixEntry; publicationId: string }): void {
  console.log(`[DiscoverMetrics] ${event}`, JSON.stringify(payload));
}
```

Use in both handlers:
- before `createProject()` => `discover_remix_click`
- after project creation => `discover_remix_project_created`

**Step 4: Run tests to verify they pass**

Run:
`pnpm test -- tests/inspiration-discovery/remix-utils.test.ts tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/discover-remix-entry-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/observability/discover.ts src/app/app/discover/page.tsx src/app/app/discover/[id]/page.tsx tests/inspiration-discovery/discover-remix-entry-contract.test.ts tests/inspiration-discovery/remix-utils.test.ts tests/inspiration-discovery/publication-card-contract.test.ts
git commit -m "chore: add discover remix funnel metrics and regression coverage"
```

---

## Non-Goals (this iteration)

- No recommendation algorithm changes
- No Discover layout redesign beyond CTA insertion
- No database schema or RPC changes
- No advanced template system for prompt composition

## Verification Checklist

- Discover gallery cards provide a functional remix CTA
- Publication detail provides a functional remix CTA
- Remix action creates project and routes with `source=discover`, `entry`, and `ref`
- Prompt builder handles sparse data with safe fallback
- Error path shows user-friendly feedback and keeps current page usable
- Contract + unit tests pass for remix flow
