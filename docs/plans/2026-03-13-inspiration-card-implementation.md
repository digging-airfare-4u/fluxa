# Inspiration Card Feed Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the home and discover inspiration cards from heavy, aligned work cards into lighter Xiaohongshu-style browsing cards with natural height variation and lower visual weight.

**Architecture:** Keep the existing `fetchGalleryPublications` query flow and masonry column layout. Concentrate the UI change in `src/components/discover/PublicationCard.tsx`, then make small page-level adjustments in `src/app/app/page.tsx` and `src/app/app/discover/page.tsx` so the home section feels like a lighter preview feed while discover remains the denser browsing feed. Use Vitest source-contract tests first to lock the intended structure before changing any UI code.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, next-intl, Vitest

---

### Task 1: Rebuild `PublicationCard` as a lightweight feed card

**Files:**
- Modify: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Modify: `src/components/discover/PublicationCard.tsx:1-69`

**Step 1: Write the failing test**

Replace the existing contract test with this stricter feed-card contract:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('renders a lightweight feed card instead of an action-heavy work card', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain("const IMAGE_RATIO_CLASSES = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square'] as const");
    expect(source).toContain('getImageRatioClass(publication.id)');
    expect(source).toContain('line-clamp-2');
    expect(source).toContain('publication.display_name');
    expect(source).toContain('publication.like_count');
    expect(source).toContain('href={`/app/discover/${publication.id}`}');
    expect(source).not.toContain('LikeButton');
    expect(source).not.toContain('BookmarkButton');
    expect(source).not.toContain('publication.view_count');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: FAIL because the current card still imports `LikeButton` / `BookmarkButton`, still shows `publication.view_count`, and does not yet define deterministic image-ratio classes.

**Step 3: Write minimal implementation**

Update `src/components/discover/PublicationCard.tsx` to:
- remove `LikeButton` and `BookmarkButton`
- replace the view-count row with a single lightweight like-count indicator
- move the visual weight into the image rather than a white boxed container
- use a deterministic image-ratio helper so cards feel staggered without changing backend data
- keep `footerActions` support for profile/bookmark management screens

Use this implementation shape:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
}

const IMAGE_RATIO_CLASSES = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square'] as const;

function getImageRatioClass(id: string) {
  const hash = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return IMAGE_RATIO_CLASSES[hash % IMAGE_RATIO_CLASSES.length];
}

export function PublicationCard({ publication, footerActions }: PublicationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRatioClass = getImageRatioClass(publication.id);

  return (
    <Link href={`/app/discover/${publication.id}`} className="group block mb-3 break-inside-avoid sm:mb-4">
      <article className="space-y-2.5">
        <div className={cn('relative w-full overflow-hidden rounded-2xl bg-muted', imageRatioClass)}>
          <Image
            src={publication.cover_image_url}
            alt={publication.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              'object-cover transition-transform duration-300 group-hover:scale-[1.02]',
              !imageLoaded && 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
          />
          {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
        </div>

        <div className="space-y-1.5 px-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{publication.title}</h3>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {publication.avatar_url ? (
                <Image src={publication.avatar_url} alt="" width={20} height={20} className="size-5 rounded-full object-cover" unoptimized />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {(publication.display_name || 'U')[0]}
                </div>
              )}
              <span className="truncate text-xs text-muted-foreground">{publication.display_name || 'User'}</span>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Heart className="size-3.5" />
              {publication.like_count}
            </span>
          </div>

          {footerActions ? <div className="pt-1.5">{footerActions}</div> : null}
        </div>
      </article>
    </Link>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-card-contract.test.ts src/components/discover/PublicationCard.tsx
git commit -m "feat: restyle publication cards as lightweight feed items"
```

---

### Task 2: Tighten the homepage inspiration section into a lighter preview feed

**Files:**
- Modify: `tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`
- Modify: `src/app/app/page.tsx:36-42`
- Modify: `src/app/app/page.tsx:381-418`

**Step 1: Write the failing test**

Extend the existing home contract test with a preview-feed assertion:

```ts
it('uses a tighter preview masonry rhythm for the inspiration section', () => {
  expect(content).toContain("const HOME_INSPIRATION_SKELETON_HEIGHTS = ['h-44', 'h-56', 'h-48', 'h-64'] as const");
  expect(content).toContain('columns-2 lg:columns-3 gap-3 sm:gap-4');
  expect(content).toContain('HOME_INSPIRATION_SKELETON_HEIGHTS[i % HOME_INSPIRATION_SKELETON_HEIGHTS.length]');
  expect(content).toContain('<PublicationCard key={publication.id} publication={publication} />');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`
Expected: FAIL because the page does not yet define `HOME_INSPIRATION_SKELETON_HEIGHTS` and still uses the older wider-gap masonry markup.

**Step 3: Write minimal implementation**

Add a small skeleton-height constant near the existing `QUICK_TAGS` constant and tighten the preview masonry section.

Use this implementation shape in `src/app/app/page.tsx`:

```tsx
const HOME_INSPIRATION_SKELETON_HEIGHTS = ['h-44', 'h-56', 'h-48', 'h-64'] as const;
```

```tsx
{isInspirationLoading ? (
  <div className="columns-2 lg:columns-3 gap-3 sm:gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'mb-3 break-inside-avoid rounded-2xl bg-muted animate-pulse sm:mb-4',
          HOME_INSPIRATION_SKELETON_HEIGHTS[i % HOME_INSPIRATION_SKELETON_HEIGHTS.length]
        )}
      />
    ))}
  </div>
) : inspirationItems.length > 0 ? (
  <div className="columns-2 lg:columns-3 gap-3 sm:gap-4">
    {inspirationItems.map((publication) => (
      <PublicationCard key={publication.id} publication={publication} />
    ))}
  </div>
) : (
  // keep existing empty/error state
)}
```

Do not change the query behavior:
- keep `fetchGalleryPublications({ sortBy: 'latest', limit: 6 })`
- keep the section after recent projects
- keep the discover navigation CTA

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts src/app/app/page.tsx
git commit -m "feat: tighten home inspiration preview feed"
```

---

### Task 3: Keep Discover as the denser browsing feed with matching card rhythm

**Files:**
- Create: `tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
- Modify: `src/app/app/discover/page.tsx:23-25`
- Modify: `src/app/app/discover/page.tsx:236-267`

**Step 1: Write the failing test**

Create `tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover feed card layout contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );

  it('keeps discover as the denser browsing feed without changing query flow', () => {
    expect(source).toContain("const DISCOVER_SKELETON_HEIGHTS = ['h-48', 'h-64', 'h-56', 'h-72'] as const");
    expect(source).toContain('columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-3 sm:gap-4 pt-2');
    expect(source).toContain('DISCOVER_SKELETON_HEIGHTS[i % DISCOVER_SKELETON_HEIGHTS.length]');
    expect(source).toContain('<PublicationCard key={pub.id} publication={pub} />');
    expect(source).toContain('fetchGalleryPublications');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
Expected: FAIL because the page does not yet define `DISCOVER_SKELETON_HEIGHTS` or the tighter masonry markup.

**Step 3: Write minimal implementation**

Add a discover-only skeleton-height constant and tighten the masonry/skeleton rhythm while preserving the current search, sort, category, infinite-scroll, and query logic.

Use this implementation shape in `src/app/app/discover/page.tsx`:

```tsx
const PAGE_SIZE = 20;
const DEBOUNCE_MS = 500;
const DISCOVER_SKELETON_HEIGHTS = ['h-48', 'h-64', 'h-56', 'h-72'] as const;
```

```tsx
{isLoading ? (
  <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-3 sm:gap-4 pt-2">
    {Array.from({ length: 12 }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'mb-3 break-inside-avoid rounded-2xl bg-muted animate-pulse sm:mb-4',
          DISCOVER_SKELETON_HEIGHTS[i % DISCOVER_SKELETON_HEIGHTS.length]
        )}
      />
    ))}
  </div>
) : publications.length === 0 ? (
  // keep existing empty state
) : (
  <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-3 sm:gap-4 pt-2">
    {publications.map((pub) => (
      <PublicationCard key={pub.id} publication={pub} />
    ))}
  </div>
)}
```

Do not change:
- `fetchGalleryPublications(...)`
- URL-driven filters
- infinite scroll sentinel behavior
- top-bar controls

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts src/app/app/discover/page.tsx
git commit -m "feat: tighten discover feed rhythm"
```

---

### Task 4: Run the focused regression suite and stop if anything else breaks

**Files:**
- Test: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Test: `tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`
- Test: `tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
- Modify only if needed: `src/components/discover/PublicationCard.tsx`
- Modify only if needed: `src/app/app/page.tsx`
- Modify only if needed: `src/app/app/discover/page.tsx`

**Step 1: Write the failing test**

No new test file in this task. The regression gate is the combined suite.

**Step 2: Run test to verify current state**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
Expected: PASS if Tasks 1-3 are complete; FAIL if any contract drift remains.

**Step 3: Write minimal implementation**

If the combined run fails:
- fix only the specific contract drift
- do not add backend fields
- do not change `src/lib/supabase/queries/publications.ts`
- do not reintroduce action-heavy card UI

**Step 4: Run test and lint to verify it passes cleanly**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts && pnpm lint`
Expected: all three tests PASS and lint exits 0

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts src/components/discover/PublicationCard.tsx src/app/app/page.tsx src/app/app/discover/page.tsx
git commit -m "test: lock lightweight inspiration feed layout"
```

---

## Non-Goals

- Do not change Supabase RPCs or add new gallery fields
- Do not add card variants or new component abstractions unless the current implementation becomes impossible to keep readable
- Do not redesign profile, bookmarks, or detail-page layouts beyond what naturally changes through the shared `PublicationCard`
- Do not add hover-only desktop affordances, long descriptions, or extra metadata rows in this pass

## Verification Checklist

- `PublicationCard` no longer renders `LikeButton`, `BookmarkButton`, or `publication.view_count`
- Card images use deterministic aspect-ratio classes to create controlled stagger
- Card text uses a 2-line title and a single lightweight meta row
- Home inspiration section remains a lighter preview feed with tighter masonry spacing
- Discover page remains the denser browsing feed with the same query/filter behavior intact
- Focused Vitest contracts pass
- `pnpm lint` passes
