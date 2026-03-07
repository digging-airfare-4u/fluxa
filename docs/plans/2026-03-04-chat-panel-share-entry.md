# Chat Panel Share Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the share entry always visible in the chat panel top-right and open `ShareDialog` from that button.

**Architecture:** Keep the change local to `ChatPanel` to minimize regression risk. Add a local dialog open state (`isShareOpen`), render a share icon button in the existing chat header action group, and mount `ShareDialog` using existing `conversationId`, `projectId`, and `documentId` props.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest.

---

### Task 1: Add a failing contract test for chat header share entry

**Files:**
- Create: `tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts`
- Read reference: `src/components/chat/ChatPanel.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat panel share entry contract', () => {
  const file = resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx');
  const content = readFileSync(file, 'utf-8');

  it('renders a share trigger in header action area', () => {
    expect(content).toContain('Share2');
    expect(content).toContain('onClick={() => setIsShareOpen(true)}');
  });

  it('mounts ShareDialog with required identifiers', () => {
    expect(content).toContain('<ShareDialog');
    expect(content).toContain('open={isShareOpen}');
    expect(content).toContain('conversationId={conversationId}');
    expect(content).toContain('projectId={projectId}');
    expect(content).toContain('documentId={documentId}');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts`

Expected: FAIL because `ChatPanel.tsx` does not yet include `ShareDialog` wiring and share trigger.

**Step 3: Commit failing test**

```bash
git add tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts
git commit -m "test: add failing contract for chat panel share entry"
```

---

### Task 2: Implement share entry and dialog wiring in ChatPanel

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`
- Test: `tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts`

**Step 1: Add minimal implementation**

Apply these exact changes in `ChatPanel.tsx`:

1. Update icon imports:

```ts
import { ChevronRight, ChevronLeft, Share2 } from 'lucide-react';
```

2. Add ShareDialog import:

```ts
import { ShareDialog } from '@/components/share';
```

3. Add local dialog state near other `useState` declarations:

```ts
const [isShareOpen, setIsShareOpen] = useState(false);
```

4. In the header action container (`className="flex items-center gap-0"`), add share button before collapse button:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 rounded text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
      onClick={() => setIsShareOpen(true)}
      aria-label="Share"
    >
      <Share2 className="size-3.5" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>分享</TooltipContent>
</Tooltip>
```

5. Mount dialog near existing dialogs at the bottom of component:

```tsx
<ShareDialog
  open={isShareOpen}
  onOpenChange={setIsShareOpen}
  conversationId={conversationId}
  projectId={projectId}
  documentId={documentId}
/>
```

**Step 2: Run targeted test to verify it passes**

Run: `pnpm vitest --run tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts`

Expected: PASS.

**Step 3: Run full test suite for confidence**

Run: `pnpm test`

Expected: Existing suite remains green (or unchanged known failures only).

**Step 4: Commit implementation**

```bash
git add src/components/chat/ChatPanel.tsx tests/inspiration-discovery/chat-panel-share-entry-contract.test.ts
git commit -m "feat: add always-visible chat header share entry"
```

---

### Task 3: Manual verification in running dev server

**Files:**
- Verify behavior in browser (no file change required)

**Step 1: Verify visibility**

Open editor page and confirm chat panel top-right always shows share icon while panel is expanded.

**Step 2: Verify interaction**

Click share icon and confirm `ShareDialog` opens.
Close via dialog close action and verify it closes cleanly.

**Step 3: Verify no regressions in header controls**

Confirm collapse button still works exactly as before.

**Step 4: Commit (only if any final tweak was needed)**

```bash
git add <touched-files>
git commit -m "fix: polish chat header share interaction"
```
