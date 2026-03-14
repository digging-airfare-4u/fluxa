# Discover Detail Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace discover-card page navigation with an in-place detail dialog, reuse the existing publication detail experience inside that dialog, and delete the standalone `/app/discover/[id]` page.

**Architecture:** Extract the current detail-page data loading and UI from `src/app/app/discover/[id]/page.tsx` into reusable discover components. Teach `PublicationCard` to open a shared dialog instead of linking to a route, and make related cards inside the dialog switch the active publication without leaving the modal. Keep the existing Supabase query layer, social components, and interaction store; only change how the detail UI is mounted.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Radix Dialog via shadcn/ui, next-intl, Vitest, Zustand, Supabase client

---

### Task 1: Lock the new click contract for discover cards

**Files:**
- Modify: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Modify: `src/components/discover/PublicationCard.tsx:1-64`

**Step 1: Write the failing test**

Replace the old route-link assertions in `tests/inspiration-discovery/publication-card-contract.test.ts` with a contract that matches modal-driven cards:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublicationCard contract', () => {
  it('opens discover detail in-place instead of linking to a route', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
      'utf8'
    );

    expect(source).toContain('const IMAGE_RATIO_CLASSES');
    expect(source).toContain('function getImageRatioClass(publicationId: string)');
    expect(source).toContain('getImageRatioClass(publication.id)');
    expect(source).toContain('onOpenDetail?: (publicationId: string) => void');
    expect(source).toContain('onClick={() => onOpenDetail?.(publication.id)}');
    expect(source).toContain('type="button"');
    expect(source).toContain('line-clamp-2');
    expect(source).toContain('publication.display_name');
    expect(source).toContain('publication.like_count');
    expect(source).toContain('footerActions');
    expect(source).not.toContain('href={`/app/discover/${publication.id}`}');
    expect(source).not.toContain("router.push(`/app/discover/${publication.id}`)");
    expect(source).not.toContain('<Link');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: FAIL because `PublicationCard` still imports `next/link` and still renders `href={`/app/discover/${publication.id}`}`.

**Step 3: Write minimal implementation**

Update `src/components/discover/PublicationCard.tsx` so the card becomes a button-driven presentational component.

Use this implementation shape:

```tsx
'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

const IMAGE_RATIO_CLASSES = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square'] as const;

function getImageRatioClass(publicationId: string) {
  const hash = publicationId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return IMAGE_RATIO_CLASSES[hash % IMAGE_RATIO_CLASSES.length];
}

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
  onOpenDetail?: (publicationId: string) => void;
}

export function PublicationCard({ publication, footerActions, onOpenDetail }: PublicationCardProps) {
  return (
    <article className="mb-3 break-inside-avoid space-y-3 sm:mb-4">
      <button type="button" onClick={() => onOpenDetail?.(publication.id)} className="group block w-full text-left">
        {/* keep existing lightweight feed card body */}
      </button>

      {footerActions ? <div className="px-1">{footerActions}</div> : null}
    </article>
  );
}
```

Keep the lightweight feed-card styling already present. Do not add fallback navigation; the modal owner will provide `onOpenDetail`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-card-contract.test.ts src/components/discover/PublicationCard.tsx
git commit -m "feat: make discover cards open detail callbacks"
```

---

### Task 2: Extract reusable publication detail content for modal rendering

**Files:**
- Create: `tests/inspiration-discovery/publication-detail-dialog-contract.test.ts`
- Create: `src/components/discover/PublicationDetailContent.tsx`
- Create: `src/components/discover/PublicationDetailDialog.tsx`
- Modify: `src/components/discover/index.ts:1-1`
- Modify: `src/app/app/discover/[id]/page.tsx:1-303`

**Step 1: Write the failing test**

Create `tests/inspiration-discovery/publication-detail-dialog-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('publication detail dialog contract', () => {
  const dialogSource = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationDetailDialog.tsx'),
    'utf8'
  );
  const contentSource = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationDetailContent.tsx'),
    'utf8'
  );

  it('renders publication detail inside a large scrollable dialog', () => {
    expect(dialogSource).toContain('Dialog');
    expect(dialogSource).toContain('DialogContent');
    expect(dialogSource).toContain('max-w-5xl');
    expect(dialogSource).toContain('max-h-[90vh]');
    expect(dialogSource).toContain('overflow-y-auto');
    expect(dialogSource).toContain('publicationId');
    expect(dialogSource).toContain('onPublicationChange');
    expect(dialogSource).toContain('<PublicationDetailContent');
  });

  it('moves the former detail page content into a reusable component', () => {
    expect(contentSource).toContain('fetchPublicationDetail');
    expect(contentSource).toContain('fetchPublicationSnapshot');
    expect(contentSource).toContain('fetchRelatedPublications');
    expect(contentSource).toContain('checkUserInteractions');
    expect(contentSource).toContain('incrementViewCount');
    expect(contentSource).toContain('CommentSection');
    expect(contentSource).toContain('LikeButton');
    expect(contentSource).toContain('BookmarkButton');
    expect(contentSource).toContain('FollowButton');
    expect(contentSource).toContain('onOpenPublication');
    expect(contentSource).toContain('<PublicationCard key={item.id} publication={item} onOpenDetail={onOpenPublication} />');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/publication-detail-dialog-contract.test.ts`
Expected: FAIL because neither new component exists yet.

**Step 3: Write minimal implementation**

Create `src/components/discover/PublicationDetailContent.tsx` by moving the reusable detail logic out of `src/app/app/discover/[id]/page.tsx`.

Requirements:
- Keep `'use client'`
- Accept props:

```ts
interface PublicationDetailContentProps {
  publicationId: string;
  onOpenPublication: (publicationId: string) => void;
}
```

- Move these imports and behaviors from the page into the component:
  - `fetchPublicationDetail`
  - `fetchPublicationSnapshot`
  - `fetchRelatedPublications`
  - `incrementViewCount`
  - `checkUserInteractions`
  - `fetchPublicProfile`
  - `LikeButton`
  - `BookmarkButton`
  - `CommentSection`
  - `FollowButton`
  - `useInteractionStore`
  - `supabase.auth.getUser()`
- Keep the existing message-image extraction helper.
- Remove page-only behavior such as `router.back()` and the fixed top bar.
- Replace related-card rendering with:

```tsx
<PublicationCard key={item.id} publication={item} onOpenDetail={onOpenPublication} />
```

- Render loading and not-found states inline inside the modal body instead of as full-screen pages.

Create `src/components/discover/PublicationDetailDialog.tsx` with this shape:

```tsx
'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PublicationDetailContent } from './PublicationDetailContent';

interface PublicationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string | null;
  onPublicationChange: (publicationId: string) => void;
}

export function PublicationDetailDialog({
  open,
  onOpenChange,
  publicationId,
  onPublicationChange,
}: PublicationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:max-w-5xl">
        {publicationId ? (
          <PublicationDetailContent
            publicationId={publicationId}
            onOpenPublication={onPublicationChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

Update `src/components/discover/index.ts` to export both new components.

Temporarily keep `src/app/app/discover/[id]/page.tsx`, but replace its duplicated logic by mounting the new reusable content:

```tsx
'use client';

import { use } from 'react';
import { PublicationDetailContent } from '@/components/discover';

export default function PublicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PublicationDetailContent publicationId={id} onOpenPublication={() => {}} />;
}
```

This keeps the route compiling while the modal integration is built.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/publication-detail-dialog-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-detail-dialog-contract.test.ts src/components/discover/PublicationDetailContent.tsx src/components/discover/PublicationDetailDialog.tsx src/components/discover/index.ts src/app/app/discover/[id]/page.tsx
git commit -m "feat: extract reusable discover detail dialog"
```

---

### Task 3: Mount the shared detail dialog on the home and discover feeds

**Files:**
- Create: `tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts`
- Modify: `src/app/app/page.tsx:7-440`
- Modify: `src/app/app/discover/page.tsx:8-269`

**Step 1: Write the failing test**

Create `tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover detail modal hosts contract', () => {
  const homeSource = readFileSync(resolve(process.cwd(), 'src/app/app/page.tsx'), 'utf8');
  const discoverSource = readFileSync(resolve(process.cwd(), 'src/app/app/discover/page.tsx'), 'utf8');

  it('opens publication detail dialog from the home inspiration section', () => {
    expect(homeSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(homeSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(homeSource).toContain('onOpenDetail={(publicationId) => {');
    expect(homeSource).toContain('setActivePublicationId(publicationId);');
    expect(homeSource).toContain('setIsPublicationDialogOpen(true);');
    expect(homeSource).toContain('<PublicationDetailDialog');
  });

  it('opens publication detail dialog from the discover browsing feed', () => {
    expect(discoverSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(discoverSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(discoverSource).toContain('<PublicationCard key={pub.id} publication={pub} onOpenDetail={handleOpenPublication} />');
    expect(discoverSource).toContain('<PublicationDetailDialog');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts`
Expected: FAIL because neither feed owns dialog state yet.

**Step 3: Write minimal implementation**

In `src/app/app/page.tsx`:
- import `PublicationDetailDialog` from `@/components/discover`
- add state near the existing `profileOpen` / `settingsOpen` state:

```tsx
const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
```

- wire the inspiration cards like this:

```tsx
<PublicationCard
  key={publication.id}
  publication={publication}
  onOpenDetail={(publicationId) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }}
/>
```

- mount the dialog near the other top-level dialogs:

```tsx
<PublicationDetailDialog
  open={isPublicationDialogOpen}
  onOpenChange={setIsPublicationDialogOpen}
  publicationId={activePublicationId}
  onPublicationChange={setActivePublicationId}
/>
```

In `src/app/app/discover/page.tsx`:
- import `PublicationDetailDialog`
- add the same two pieces of state
- create a dedicated callback:

```tsx
const handleOpenPublication = useCallback((publicationId: string) => {
  setActivePublicationId(publicationId);
  setIsPublicationDialogOpen(true);
}, []);
```

- render cards like this:

```tsx
<PublicationCard key={pub.id} publication={pub} onOpenDetail={handleOpenPublication} />
```

- mount the dialog at the bottom of the page tree with the same four props as home.

Do not change existing home/discover queries, filters, or masonry layout.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts src/app/app/page.tsx src/app/app/discover/page.tsx
git commit -m "feat: open discover detail dialog from feed hosts"
```

---

### Task 4: Delete the standalone discover detail page after modal migration

**Files:**
- Create: `tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts`
- Modify: `src/app/app/profile/page.tsx:231-244`
- Delete: `src/app/app/discover/[id]/page.tsx`

**Step 1: Write the failing test**

Create `tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover detail route removal contract', () => {
  it('removes the standalone discover detail page', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/app/discover/[id]/page.tsx'))).toBe(false);
  });

  it('removes direct discover detail pushes from profile actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8');
    expect(source).not.toContain("router.push(`/app/discover/${pub.id}`)");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts`
Expected: FAIL because the route file still exists and profile still pushes to `/app/discover/${pub.id}`.

**Step 3: Write minimal implementation**

Delete `src/app/app/discover/[id]/page.tsx`.

In `src/app/app/profile/page.tsx`, remove the direct route push used by the publication-management footer. Keep YAGNI: if there is no confirmed replacement action, replace the old route-dependent button with a non-routing action label.

Use this exact replacement in the publications tab footer:

```tsx
<div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
  <Button size="sm" variant="outline" disabled>
    Detail in modal
  </Button>
  <Button size="sm" variant="secondary" onClick={() => handleHideToggle(pub)}>
    {pub.status === 'hidden' ? 'Unhide' : 'Hide'}
  </Button>
</div>
```

This removes the dead route dependency without inventing a new editing flow.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts src/app/app/profile/page.tsx
git rm src/app/app/discover/[id]/page.tsx
git commit -m "refactor: remove standalone discover detail page"
```

---

### Task 5: Run focused regression verification before claiming completion

**Files:**
- Test: `tests/inspiration-discovery/publication-card-contract.test.ts`
- Test: `tests/inspiration-discovery/publication-detail-dialog-contract.test.ts`
- Test: `tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts`
- Test: `tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts`
- Test: `tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts`
- Test: `tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts`
- Modify only if needed: `src/components/discover/PublicationCard.tsx`
- Modify only if needed: `src/components/discover/PublicationDetailContent.tsx`
- Modify only if needed: `src/components/discover/PublicationDetailDialog.tsx`
- Modify only if needed: `src/app/app/page.tsx`
- Modify only if needed: `src/app/app/discover/page.tsx`
- Modify only if needed: `src/app/app/profile/page.tsx`

**Step 1: Write the failing test**

No new test file in this task. The regression gate is the combined discover-focused suite.

**Step 2: Run test to verify current state**

Run:

```bash
pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/publication-detail-dialog-contract.test.ts tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts
```

Expected: PASS if Tasks 1-4 are complete; FAIL if any modal migration contract drift remains.

**Step 3: Write minimal implementation**

If the suite fails, fix only the specific contract drift:
- keep home/discover masonry classes unchanged unless a contract requires exact text
- do not change `src/lib/supabase/queries/publications.ts`
- do not reintroduce route-based detail navigation
- do not add new abstractions beyond the two discover detail components already planned

**Step 4: Run test and lint to verify it passes cleanly**

Run:

```bash
pnpm test -- tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/publication-detail-dialog-contract.test.ts tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts && pnpm lint
```

Expected: all six tests PASS and lint exits 0.

**Step 5: Commit**

```bash
git add tests/inspiration-discovery/publication-card-contract.test.ts tests/inspiration-discovery/publication-detail-dialog-contract.test.ts tests/inspiration-discovery/discover-detail-modal-hosts-contract.test.ts tests/inspiration-discovery/discover-detail-route-removal-contract.test.ts tests/inspiration-discovery/app-home-inspiration-section-contract.test.ts tests/inspiration-discovery/discover-feed-card-layout-contract.test.ts src/components/discover/PublicationCard.tsx src/components/discover/PublicationDetailContent.tsx src/components/discover/PublicationDetailDialog.tsx src/components/discover/index.ts src/app/app/page.tsx src/app/app/discover/page.tsx src/app/app/profile/page.tsx
git commit -m "test: lock discover detail modal workflow"
```

---

## Non-Goals

- Do not redesign the detail experience beyond adapting it to a scrollable dialog container
- Do not change Supabase query signatures or RPC behavior
- Do not introduce a global modal store unless the local host-state approach becomes impossible
- Do not invent a new publication-edit flow for the profile page in this pass
- Do not change the existing home/discover feed loading strategy, filters, or masonry rhythm

## Verification Checklist

- `PublicationCard` opens detail through `onOpenDetail` instead of route navigation
- `PublicationDetailContent` owns the former page-level detail fetch + render logic
- `PublicationDetailDialog` is a large scrollable dialog that hosts the reusable content
- Home inspiration cards open the detail modal without leaving `/app`
- Discover feed cards open the detail modal without leaving `/app/discover`
- Related publication cards switch detail content inside the same dialog
- `src/app/app/discover/[id]/page.tsx` is deleted
- `src/app/app/profile/page.tsx` no longer pushes to `/app/discover/${pub.id}`
- Focused Vitest contracts pass
- `pnpm lint` passes
