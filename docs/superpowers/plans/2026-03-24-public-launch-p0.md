# Public Launch P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Fluxa to public-launch P0 by adding release gates, stabilizing the core creation loop, making payment and entitlement flows trustworthy, and tightening discovery/sharing into a credible public loop.

**Architecture:** Keep the current Next.js + Supabase structure and close launch gaps in place. Use the repo’s existing contract-style test approach for structural guarantees, add runnable smoke documents for launch-critical user loops, and add a small launch observability baseline using the existing `src/lib/observability/*` utilities so operators can identify failures without guessing. Avoid large refactors; prefer focused route fallbacks, user-facing state handling, and launch docs.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, Supabase, Sonner, Vitest, GitHub Actions

---

## File Map

### Package 1 — Release Gates
- Create: `.github/workflows/ci.yml`
- Create: `docs/release-public-launch-checklist.md`
- Create: `docs/release-public-launch-go-no-go.md`
- Create: `scripts/verify-launch-env.mjs`
- Modify: `README.md`
- Modify: `package.json`
- Test: `tests/launch-p0/release-gates-contract.test.ts`

### Package 2 — Core Creation Loop
- Create: `src/app/loading.tsx`
- Create: `src/app/app/loading.tsx`
- Create: `src/app/app/error.tsx`
- Create: `src/app/app/p/[projectId]/loading.tsx`
- Create: `src/app/app/p/[projectId]/not-found.tsx`
- Create: `docs/smoke/core-creation.md`
- Modify: `src/app/page.tsx`
- Modify: `src/app/auth/page.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `src/components/home/ProjectGrid.tsx`
- Modify: `src/app/app/p/[projectId]/page.tsx`
- Modify: `src/components/editor/EditorLayout.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/canvas/CanvasStage.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/editor-route-fallbacks-contract.test.ts`
- Test: `tests/launch-p0/core-entry-contract.test.ts`
- Test: `tests/launch-p0/editor-recovery-contract.test.ts`

### Package 4 — Commercial Trust Loop
- Create: `docs/runbooks/payment-issue-response.md`
- Create: `docs/smoke/commercial-trust.md`
- Modify: `src/components/pricing/Pricing.tsx`
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Modify: `src/components/points/InsufficientPointsDialog.tsx`
- Modify: `src/components/points/UserProfilePoints.tsx`
- Modify: `src/components/points/TransactionHistory.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/app/api/payments/checkout/route.ts`
- Modify: `src/app/api/payments/order-status/route.ts`
- Modify: `src/app/api/invite/redeem/route.ts`
- Modify: `src/lib/store/usePointsStore.ts` if needed for delayed-entitlement refresh
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/commercial-trust-contract.test.ts`
- Test: `tests/launch-p0/invite-and-entitlement-contract.test.ts`
- Test: `tests/launch-p0/payment-route-contract.test.ts`

### Package 3 — Discovery & Sharing Loop
- Create: `docs/runbooks/public-content-takedown.md`
- Create: `docs/smoke/discovery-sharing.md`
- Create: `src/app/app/discover/loading.tsx`
- Modify: `src/components/share/ShareDialog.tsx`
- Modify: `src/components/share/PublishForm.tsx`
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/components/discover/PublicationDetailDialog.tsx`
- Modify: `src/components/discover/PublicationDetailContent.tsx`
- Modify: `src/components/discover/PublicationCard.tsx`
- Modify: `src/components/social/CommentSection.tsx`
- Modify: `src/lib/supabase/queries/publications.ts`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/publish-flow-contract.test.ts`
- Test: `tests/launch-p0/discover-route-fallback-contract.test.ts`
- Test: `tests/launch-p0/discovery-sharing-contract.test.ts`

### Shared launch-floor files
- Create: `docs/runbooks/launch-observability.md`
- Modify: `src/lib/observability/metrics.ts`
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/p/[projectId]/page.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/share/PublishForm.tsx`
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/components/auth/AuthDialog.tsx`
- Modify: `src/components/discover/PublicationDetailDialog.tsx`
- Modify: `src/components/points/InsufficientPointsDialog.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/auth/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`
- Test: `tests/launch-p0/launch-observability-contract.test.ts`

---

## Smoke Test Strategy

This plan uses two verification layers:

1. **Contract tests** to prove launch-required files, route fallbacks, and structural code rules exist.
2. **Runnable smoke docs** to define exact manual/operator verification for the user loops required by the spec.

The smoke docs must contain exact steps, expected outcomes, and failure notes for:
- `auth_to_first_generation`
- `empty_project_to_editor`
- `return_to_existing_project`
- `generation_failure_feedback`
- `insufficient_points_to_checkout`
- `checkout_success_updates_balance`
- `checkout_timeout_recovery`
- `invite_redeem_success_failure`
- `publish_new_work`
- `browse_discover_detail`
- `remix_back_to_editor`
- `interaction_requires_auth`

---

## Migrations and Edge Function Assessment

This plan is intentionally scoped to **application code, route handlers, tests, and launch docs**.

- **Package 1:** No Supabase migrations or Edge Functions planned.
- **Package 2:** No Supabase migrations or Edge Functions planned. Reuse existing project/document/conversation data paths.
- **Package 4:** No Supabase migrations or Edge Functions planned. Reuse existing payment routes, invite route, and entitlement surfaces.
- **Package 3:** No Supabase migrations or Edge Functions planned. Reuse existing publication, category, bookmark, and comment data paths.
- **Shared launch-floor tasks:** No Supabase migrations or Edge Functions planned. Reuse existing `src/lib/observability/*` logging/metrics utilities.

If execution proves that a schema or Edge Function change is actually required, stop, record the blocker in `docs/release-public-launch-go-no-go.md`, and add a new explicitly scoped follow-up task instead of silently expanding this plan.

---

### Task 1: Add release gates, env verification, checklist, and go/no-go template

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/release-public-launch-checklist.md`
- Create: `docs/release-public-launch-go-no-go.md`
- Create: `scripts/verify-launch-env.mjs`
- Modify: `README.md`
- Modify: `package.json`
- Test: `tests/launch-p0/release-gates-contract.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('public launch release gates contract', () => {
  it('defines CI for lint, test, and build', () => {
    const file = resolve(process.cwd(), '.github/workflows/ci.yml')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf8')
    expect(content).toContain('pnpm lint')
    expect(content).toContain('pnpm test')
    expect(content).toContain('pnpm build')
  })

  it('defines checklist, go-no-go template, and env verification script', () => {
    expect(existsSync(resolve(process.cwd(), 'docs/release-public-launch-checklist.md'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'docs/release-public-launch-go-no-go.md'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'scripts/verify-launch-env.mjs'))).toBe(true)
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/release-gates-contract.test.ts` with the test above**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/release-gates-contract.test.ts`
Expected: FAIL because the workflow, checklist, go/no-go template, and env verification script do not exist.

- [ ] **Step 4: Create `scripts/verify-launch-env.mjs`**

The script should support two modes:
- default mode for local/final verification: fail if required public env vars are missing
- `--ci` mode for GitHub Actions: verify that the required variable names are declared in the workflow `env:` block using placeholder values like `test-value`, without requiring real secrets in PR validation

The script must also:
- check for the launch-critical keys documented in the spec/README
- never print secret values
- return non-zero exit code on failure

- [ ] **Step 5: Create `.github/workflows/ci.yml`**

Requirements:
- run on pull requests to `main`
- run on pushes to `main`
- set up Node 20 and pnpm 10
- run `pnpm install --frozen-lockfile`
- run `pnpm lint`
- run `pnpm test`
- run `pnpm build`
- define non-secret placeholder `env:` values for the required public variables
- run `node scripts/verify-launch-env.mjs --ci` so CI validates required variable presence without needing production secrets

- [ ] **Step 6: Create `docs/release-public-launch-checklist.md`**

Include pass/fail sections for:
- CI green
- env verification passed
- core creation smoke passed
- commercial smoke passed
- discovery smoke passed
- launch observability verified
- accessibility/mobile/legal baseline verified
- release owner signoff

- [ ] **Step 7: Create `docs/release-public-launch-go-no-go.md`**

Include:
- release date/time
- release owner
- current verdict: `go`, `no-go`, or `hold`
- automated checks summary
- smoke-test summary
- launch blockers
- final signoff note

- [ ] **Step 8: Update `README.md` and `package.json`**

Add:
- a documented launch verification command
- pointer to checklist and go/no-go template
- pointer to env verification script

- [ ] **Step 9: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/release-gates-contract.test.ts`
Expected: PASS

- [ ] **Step 10: Run verification commands**

Run: `node scripts/verify-launch-env.mjs && pnpm lint && pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add .github/workflows/ci.yml docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md scripts/verify-launch-env.mjs README.md package.json tests/launch-p0/release-gates-contract.test.ts
git commit -m "chore: add public launch release gates"
```

### Task 2: Add route-level loading coverage for `/`, `/app`, and `/app/p/[projectId]`

**Files:**
- Create: `src/app/loading.tsx`
- Create: `src/app/app/loading.tsx`
- Create: `src/app/app/error.tsx`
- Create: `src/app/app/p/[projectId]/loading.tsx`
- Create: `src/app/app/p/[projectId]/not-found.tsx`
- Test: `tests/launch-p0/editor-route-fallbacks-contract.test.ts`

- [ ] **Step 1: Write the failing route-fallback contract test**

```ts
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('route fallback contract', () => {
  it('adds top-level and app-level loading coverage', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/loading.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/app/app/loading.tsx'))).toBe(true)
  })

  it('adds editor loading, error, and not-found fallbacks', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/app/error.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/app/app/p/[projectId]/loading.tsx'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/app/app/p/[projectId]/not-found.tsx'))).toBe(true)
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/editor-route-fallbacks-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/editor-route-fallbacks-contract.test.ts`
Expected: FAIL because one or more route fallback files do not exist.

- [ ] **Step 4: Create `src/app/loading.tsx` and `src/app/app/loading.tsx`**

Implement minimal, launch-ready loading states that:
- avoid blank screens
- match the current visual language
- do not depend on unavailable data

- [ ] **Step 5: Create `src/app/app/error.tsx`**

Provide:
- a visible failure state
- retry action
- clear route back to `/app`

- [ ] **Step 6: Create `src/app/app/p/[projectId]/loading.tsx` and `src/app/app/p/[projectId]/not-found.tsx`**

Provide:
- visible pending state while editor data loads
- a clear missing-project recovery path

- [ ] **Step 7: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/editor-route-fallbacks-contract.test.ts`
Expected: PASS

- [ ] **Step 8: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/loading.tsx src/app/app/loading.tsx src/app/app/error.tsx src/app/app/p/[projectId]/loading.tsx src/app/app/p/[projectId]/not-found.tsx tests/launch-p0/editor-route-fallbacks-contract.test.ts
git commit -m "feat: add launch route fallbacks"
```

### Task 3: Align landing, auth, app-home entry, and recent-project re-entry

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/auth/page.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `src/components/home/ProjectGrid.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/core-entry-contract.test.ts`

- [ ] **Step 1: Write the failing core-entry contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('core entry contract', () => {
  it('routes recent project see-all to the projects route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/page.tsx'), 'utf8')
    expect(source).toContain("router.push('/app/projects')")
  })

  it('keeps landing CTA auth handoff in place', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8')
    expect(source).toContain('setShowAuthDialog(true)')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/core-entry-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/core-entry-contract.test.ts`
Expected: FAIL because at least one launch entry rule is not yet satisfied.

- [ ] **Step 4: Update `src/app/app/page.tsx` and `src/components/home/ProjectGrid.tsx`**

Tighten:
- recent-projects “see all” behavior
- recent-project re-entry clarity
- app-home first-action clarity for prompt start vs empty project start

- [ ] **Step 5: Update `src/app/page.tsx` and `src/app/auth/page.tsx` only where needed**

Keep scope to launch entry clarity:
- first CTA remains clear
- auth path remains understandable
- no confusing blank transition states

- [ ] **Step 6: Update `messages/en.json` and `messages/zh.json` for any launch-entry copy changes**

- [ ] **Step 7: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/core-entry-contract.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/auth/page.tsx src/app/app/page.tsx src/components/home/ProjectGrid.tsx messages/en.json messages/zh.json tests/launch-p0/core-entry-contract.test.ts
git commit -m "feat: tighten launch entry flow"
```

### Task 4: Stabilize editor recovery and generation feedback

**Files:**
- Modify: `src/app/app/p/[projectId]/page.tsx`
- Modify: `src/components/editor/EditorLayout.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/canvas/CanvasStage.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/editor-recovery-contract.test.ts`

- [ ] **Step 1: Write the failing editor-recovery contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('editor recovery contract', () => {
  it('removes launch-blocking canvas TODO toast placeholders', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/canvas/CanvasStage.tsx'), 'utf8')
    expect(source).not.toContain('TODO: Show error toast notification when toast system is available')
  })

  it('keeps explicit editor recovery handling in the project page', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/p/[projectId]/page.tsx'), 'utf8')
    expect(source).toMatch(/notFound|loadError|setError|setLoadError/)
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/editor-recovery-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/editor-recovery-contract.test.ts`
Expected: FAIL because the editor recovery rules are not fully implemented.

- [ ] **Step 4: Update `src/app/app/p/[projectId]/page.tsx`**

Make these states explicit:
- editor loading
- missing or inaccessible project
- incomplete project data
- retry/back-home recovery path

- [ ] **Step 5: Update `src/components/chat/ChatPanel.tsx` and `src/components/editor/EditorLayout.tsx`**

Make generation states explicit:
- submitted
- in progress
- failed
- retry guidance

- [ ] **Step 6: Update `src/components/canvas/CanvasStage.tsx`**

Replace launch-blocking TODO placeholders with real toast-based error feedback using the existing Sonner setup.

- [ ] **Step 7: Update `messages/en.json` and `messages/zh.json`**

Add or normalize copy for:
- missing project
- generation failed
- retry
- save failed
- return-home action

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/editor-recovery-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/app/app/p/[projectId]/page.tsx src/components/editor/EditorLayout.tsx src/components/chat/ChatPanel.tsx src/components/canvas/CanvasStage.tsx messages/en.json messages/zh.json tests/launch-p0/editor-recovery-contract.test.ts
git commit -m "feat: stabilize editor recovery for launch"
```

### Task 5: Write and verify core-creation smoke scenarios

**Files:**
- Create: `docs/smoke/core-creation.md`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`

- [ ] **Step 1: Create `docs/smoke/core-creation.md`**

Document exact runnable manual flows for:
- `auth_to_first_generation`
- `empty_project_to_editor`
- `return_to_existing_project`
- `generation_failure_feedback`

Each scenario must include:
- preconditions
- exact user steps
- expected UI result
- what counts as failure

- [ ] **Step 2: Run the documented scenarios manually**

Run the flows in the app using the exact steps in the document.
Expected: every scenario completes or reveals a real blocker to fix before continuing.

- [ ] **Step 3: Update `docs/release-public-launch-checklist.md` and `docs/release-public-launch-go-no-go.md`**

Record:
- the core smoke doc path
- pass/fail result for each scenario
- any launch blocker found during the run

- [ ] **Step 4: Commit**

```bash
git add docs/smoke/core-creation.md docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md
git commit -m "docs: add core creation smoke scenarios"
```

### Task 6: Tighten pricing and checkout state transitions

**Files:**
- Create: `docs/runbooks/payment-issue-response.md`
- Modify: `src/components/pricing/Pricing.tsx`
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/commercial-trust-contract.test.ts`

- [ ] **Step 1: Write the failing commercial-trust contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('commercial trust contract', () => {
  it('does not rely on full-page reload after payment success', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/pricing/Pricing.tsx'), 'utf8')
    expect(source).not.toContain('window.location.reload()')
  })

  it('keeps explicit payment terminal states in checkout', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/pricing/CheckoutDialog.tsx'), 'utf8')
    expect(source).toContain('expired')
    expect(source).toContain('closed')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/commercial-trust-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/commercial-trust-contract.test.ts`
Expected: FAIL because the pricing and checkout surfaces do not fully satisfy launch rules.

- [ ] **Step 4: Update `src/components/pricing/Pricing.tsx`**

Remove full-page reload success handling and replace it with explicit local refresh/update behavior.

- [ ] **Step 5: Update `src/components/pricing/CheckoutDialog.tsx`**

Represent the required checkout states clearly:
- login required
- creating order
- awaiting payment action
- polling/confirmation
- success
- failed
- expired
- closed/cancelled
- delayed-entitlement guidance
- retry path

- [ ] **Step 6: Update `src/app/pricing/page.tsx` and localized copy**

Keep the buying path understandable and ensure user-facing copy matches the checkout states above.

- [ ] **Step 7: Create `docs/runbooks/payment-issue-response.md`**

Include:
- how to identify order status
- how to distinguish pending vs failed vs delayed-entitlement
- what operator action is allowed
- what user-facing response to give

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/commercial-trust-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add docs/runbooks/payment-issue-response.md src/components/pricing/Pricing.tsx src/components/pricing/CheckoutDialog.tsx src/app/pricing/page.tsx messages/en.json messages/zh.json tests/launch-p0/commercial-trust-contract.test.ts
git commit -m "feat: tighten checkout states for launch"
```

### Task 7: Tighten ledger, insufficient-points, and invite messaging

**Files:**
- Modify: `src/components/points/InsufficientPointsDialog.tsx`
- Modify: `src/components/points/UserProfilePoints.tsx`
- Modify: `src/components/points/TransactionHistory.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/lib/store/usePointsStore.ts` if needed for delayed-entitlement refresh
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/invite-and-entitlement-contract.test.ts`

- [ ] **Step 1: Write the failing invite-and-entitlement contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('invite and entitlement contract', () => {
  it('does not leak internal membership field names in profile success messaging', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8')
    expect(source).not.toContain('membership_expires_at updated.')
  })

  it('does not leave the insufficient-points upgrade CTA as a pure close action', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/points/InsufficientPointsDialog.tsx'), 'utf8')
    expect(source).not.toContain('onClick={onClose}')
  })

  it('keeps transaction history visible in the ledger view', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/points/UserProfilePoints.tsx'), 'utf8')
    expect(source).toContain('TransactionHistory')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/invite-and-entitlement-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/invite-and-entitlement-contract.test.ts`
Expected: FAIL because current entitlement messaging and upgrade handoff do not yet satisfy launch rules.

- [ ] **Step 4: Update `src/components/points/InsufficientPointsDialog.tsx`**

Make the upgrade CTA lead to a real purchase path instead of acting like a close-only button.

- [ ] **Step 5: Update `src/components/points/UserProfilePoints.tsx` and `src/components/points/TransactionHistory.tsx`**

Keep balance, membership level, and transaction history visible and understandable.

- [ ] **Step 6: Update `src/app/app/profile/page.tsx` and `src/lib/store/usePointsStore.ts` if needed**

Replace internal/developer-style invite copy with user-facing copy and refresh entitlement state from the server after success.

- [ ] **Step 7: Update `messages/en.json` and `messages/zh.json`**

Normalize copy for:
- invite success/failure
- delayed entitlement
- ledger refresh
- upgrade CTA

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/invite-and-entitlement-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/points/InsufficientPointsDialog.tsx src/components/points/UserProfilePoints.tsx src/components/points/TransactionHistory.tsx src/app/app/profile/page.tsx src/lib/store/usePointsStore.ts messages/en.json messages/zh.json tests/launch-p0/invite-and-entitlement-contract.test.ts
git commit -m "feat: tighten entitlement messaging for launch"
```

### Task 8: Align payment and invite API route contracts with launch UX

**Files:**
- Modify: `src/app/api/payments/checkout/route.ts`
- Modify: `src/app/api/payments/order-status/route.ts`
- Modify: `src/app/api/invite/redeem/route.ts`
- Test: `tests/launch-p0/payment-route-contract.test.ts`

- [ ] **Step 1: Write the failing payment-route contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('payment route contract', () => {
  it('keeps machine-readable checkout responses', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/payments/checkout/route.ts'), 'utf8')
    expect(source).toContain('error')
    expect(source).toContain('code')
  })

  it('distinguishes paid, failed, expired, and closed order states', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/payments/order-status/route.ts'), 'utf8')
    expect(source).toContain('paid')
    expect(source).toContain('failed')
    expect(source).toContain('expired')
    expect(source).toContain('closed')
  })

  it('keeps safe invite business messages', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/invite/redeem/route.ts'), 'utf8')
    expect(source).toContain('BUSINESS_MESSAGES')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/payment-route-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/payment-route-contract.test.ts`
Expected: FAIL until route contracts match launch UX needs.

- [ ] **Step 4: Update `src/app/api/payments/checkout/route.ts`**

Preserve machine-readable error codes and keep the response surface stable for the client.

- [ ] **Step 5: Update `src/app/api/payments/order-status/route.ts`**

Ensure the route exposes enough signal for the client to differentiate:
- pending
- paid
- failed
- expired
- closed

- [ ] **Step 6: Update `src/app/api/invite/redeem/route.ts`**

Preserve safe business codes/messages and avoid raw internal errors in the client contract.

- [ ] **Step 7: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/payment-route-contract.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/api/payments/checkout/route.ts src/app/api/payments/order-status/route.ts src/app/api/invite/redeem/route.ts tests/launch-p0/payment-route-contract.test.ts
git commit -m "refactor: align payment route contracts for launch"
```

### Task 9: Write and verify commercial smoke scenarios

**Files:**
- Create: `docs/smoke/commercial-trust.md`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`
- Modify: `docs/runbooks/payment-issue-response.md`

- [ ] **Step 1: Create `docs/smoke/commercial-trust.md`**

Document exact runnable manual flows for:
- `insufficient_points_to_checkout`
- `checkout_success_updates_balance`
- `checkout_timeout_recovery`
- `invite_redeem_success_failure`

Include for each:
- preconditions
- exact steps
- expected UI states
- operator follow-up if the flow stalls

- [ ] **Step 2: Run the documented scenarios manually**

Use the smoke doc exactly as written.
Expected: the flows succeed or expose real blockers to resolve before launch.

- [ ] **Step 3: Update checklist, go/no-go, and payment runbook**

Record:
- the commercial smoke doc path
- pass/fail result for each scenario
- any launch blocker found during the run
- any operator notes discovered while testing

- [ ] **Step 4: Commit**

```bash
git add docs/smoke/commercial-trust.md docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md docs/runbooks/payment-issue-response.md
git commit -m "docs: add commercial smoke scenarios"
```

### Task 10: Tighten publish and share flows for public content

**Files:**
- Create: `docs/runbooks/public-content-takedown.md`
- Modify: `src/components/share/ShareDialog.tsx`
- Modify: `src/components/share/PublishForm.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/publish-flow-contract.test.ts`

- [ ] **Step 1: Write the failing publish-flow contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('publish flow contract', () => {
  it('requires title, category, and cover for publish', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/share/PublishForm.tsx'), 'utf8')
    expect(source).toContain('Title is required')
    expect(source).toContain('Category is required')
    expect(source).toContain('Cover image is required')
  })

  it('removes disabled placeholder share actions from the share dialog', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/share/ShareDialog.tsx'), 'utf8')
    expect(source).not.toContain('coming_soon')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/publish-flow-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/publish-flow-contract.test.ts`
Expected: FAIL because disabled placeholder sharing or launch-blocking validation behavior still exists.

- [ ] **Step 4: Update `src/components/share/ShareDialog.tsx`**

Keep only real P0 actions and remove disabled placeholder behavior.

- [ ] **Step 5: Update `src/components/share/PublishForm.tsx`**

Keep publish/update behavior explicit and require launch-critical public metadata.

- [ ] **Step 6: Create `docs/runbooks/public-content-takedown.md`**

Include:
- how to hide a bad public item
- what status/state to use
- manual fallback steps when moderation tooling is limited

- [ ] **Step 7: Move remaining user-facing validation copy into `messages/en.json` and `messages/zh.json`**

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/publish-flow-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add docs/runbooks/public-content-takedown.md src/components/share/ShareDialog.tsx src/components/share/PublishForm.tsx messages/en.json messages/zh.json tests/launch-p0/publish-flow-contract.test.ts
git commit -m "feat: tighten publish flow for launch"
```

### Task 11: Add discover route loading fallback and detail shell safeguards

**Files:**
- Create: `src/app/app/discover/loading.tsx`
- Modify: `src/components/discover/PublicationDetailDialog.tsx`
- Test: `tests/launch-p0/discover-route-fallback-contract.test.ts`

- [ ] **Step 1: Write the failing discover-route contract test**

```ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('discover route fallback contract', () => {
  it('adds discover loading coverage', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/app/discover/loading.tsx'))).toBe(true)
  })

  it('keeps the detail dialog shell bounded for launch', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/discover/PublicationDetailDialog.tsx'), 'utf8')
    expect(source).toContain('max-h')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/discover-route-fallback-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/discover-route-fallback-contract.test.ts`
Expected: FAIL because discover loading coverage is not explicit enough yet.

- [ ] **Step 4: Create `src/app/app/discover/loading.tsx`**

Provide a visible discover skeleton/loading state instead of a blank pending route.

- [ ] **Step 5: Update `src/components/discover/PublicationDetailDialog.tsx` only if needed**

Keep the dialog shell bounded and launch-safe for long content and smaller screens.

- [ ] **Step 6: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/discover-route-fallback-contract.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/app/discover/loading.tsx src/components/discover/PublicationDetailDialog.tsx tests/launch-p0/discover-route-fallback-contract.test.ts
git commit -m "feat: add discover route fallback for launch"
```

### Task 12: Stabilize discover feed, detail, comments, and published-only rules

**Files:**
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/components/discover/PublicationDetailContent.tsx`
- Modify: `src/components/discover/PublicationCard.tsx`
- Modify: `src/components/social/CommentSection.tsx`
- Modify: `src/lib/supabase/queries/publications.ts`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`
- Test: `tests/launch-p0/discovery-sharing-contract.test.ts`

- [ ] **Step 1: Write the failing discovery-sharing contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('discovery and sharing contract', () => {
  it('keeps discover explicit about loading, empty, and no-more states', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/app/discover/page.tsx'), 'utf8')
    expect(source).toContain('isLoading')
    expect(source).toContain('hasMore')
  })

  it('keeps discover queries limited to public published content', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/supabase/queries/publications.ts'), 'utf8')
    expect(source).toContain('published')
  })

  it('does not leave comment failures as console-only behavior', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/social/CommentSection.tsx'), 'utf8')
    expect(source).not.toContain('catch(e) { console.error(e); }')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/discovery-sharing-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/discovery-sharing-contract.test.ts`
Expected: FAIL because one or more launch discovery rules are still unmet.

- [ ] **Step 4: Update `src/components/social/CommentSection.tsx`**

Add user-visible failure feedback for comment load, submit, and delete actions.

- [ ] **Step 5: Update `src/app/app/discover/page.tsx` and `src/components/discover/PublicationCard.tsx`**

Tighten:
- loading/empty/error/no-more-results behavior
- card metadata clarity
- remix handoff clarity

- [ ] **Step 6: Update `src/components/discover/PublicationDetailContent.tsx`**

Tighten:
- detail missing/error handling
- creator/category/remix presentation
- related work and comment section resilience

- [ ] **Step 7: Update `src/lib/supabase/queries/publications.ts` and localized copy**

Ensure discover reads only intentionally public content and hidden content stays excluded.

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/discovery-sharing-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/app/discover/page.tsx src/components/discover/PublicationDetailContent.tsx src/components/discover/PublicationCard.tsx src/components/social/CommentSection.tsx src/lib/supabase/queries/publications.ts messages/en.json messages/zh.json tests/launch-p0/discovery-sharing-contract.test.ts
git commit -m "fix: stabilize discovery loop for launch"
```

### Task 13: Write and verify discovery smoke scenarios

**Files:**
- Create: `docs/smoke/discovery-sharing.md`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`
- Modify: `docs/runbooks/public-content-takedown.md`

- [ ] **Step 1: Create `docs/smoke/discovery-sharing.md`**

Document exact runnable manual flows for:
- `publish_new_work`
- `browse_discover_detail`
- `remix_back_to_editor`
- `interaction_requires_auth`

Include:
- preconditions
- exact steps
- expected results
- what to do if a public item must be hidden during verification

- [ ] **Step 2: Run the documented scenarios manually**

Use the smoke doc exactly as written.
Expected: all scenarios complete or produce real blockers before launch.

- [ ] **Step 3: Update checklist, go/no-go, and takedown runbook**

Record:
- the discovery smoke doc path
- pass/fail result for each scenario
- any blocker found during the run
- any operator notes for manual takedown fallback

- [ ] **Step 4: Commit**

```bash
git add docs/smoke/discovery-sharing.md docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md docs/runbooks/public-content-takedown.md
git commit -m "docs: add discovery smoke scenarios"
```

### Task 14: Add launch observability baseline and operator doc

**Files:**
- Create: `docs/runbooks/launch-observability.md`
- Modify: `src/lib/observability/metrics.ts`
- Modify: `src/app/app/page.tsx`
- Modify: `src/app/app/p/[projectId]/page.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/share/PublishForm.tsx`
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Test: `tests/launch-p0/launch-observability-contract.test.ts`

- [ ] **Step 1: Write the failing launch-observability contract test**

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('launch observability contract', () => {
  it('defines launch metric event names', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/observability/metrics.ts'), 'utf8')
    expect(source).toContain('project_create_failure')
    expect(source).toContain('editor_load_failure')
    expect(source).toContain('generation_failure')
    expect(source).toContain('publish_failure')
    expect(source).toContain('checkout_failure')
    expect(source).toContain('payment_success')
    expect(source).toContain('invite_redeem_failure')
  })

  it('wires launch metrics into critical user flows', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/app/app/page.tsx'), 'utf8')).toContain('trackMetric')
    expect(readFileSync(resolve(process.cwd(), 'src/components/share/PublishForm.tsx'), 'utf8')).toContain('trackMetric')
    expect(readFileSync(resolve(process.cwd(), 'src/components/pricing/CheckoutDialog.tsx'), 'utf8')).toContain('trackMetric')
    expect(readFileSync(resolve(process.cwd(), 'src/app/app/profile/page.tsx'), 'utf8')).toContain('trackMetric')
  })
})
```

- [ ] **Step 2: Create `tests/launch-p0/launch-observability-contract.test.ts`**

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/launch-p0/launch-observability-contract.test.ts`
Expected: FAIL because the launch observability baseline is not yet implemented.

- [ ] **Step 4: Extend `src/lib/observability/metrics.ts`**

Add launch-specific metric event names for:
- project creation failure
- editor load failure
- AI generation failure
- publish failure
- checkout failure
- payment success
- invite redemption failure

- [ ] **Step 5: Instrument core creation surfaces**

In `src/app/app/page.tsx`, `src/app/app/p/[projectId]/page.tsx`, and `src/components/chat/ChatPanel.tsx`, emit the launch metrics required for project-creation, editor-load, and generation failures.

- [ ] **Step 6: Instrument publish, checkout, and invite surfaces**

In `src/components/share/PublishForm.tsx`, `src/components/pricing/CheckoutDialog.tsx`, and `src/app/app/profile/page.tsx`, emit the launch metrics required for publish failure, checkout failure/payment success, and invite redemption failure.

- [ ] **Step 7: Create `docs/runbooks/launch-observability.md`**

Document:
- each required launch event
- where it is emitted
- what log prefix or payload to look for
- what operator action is expected after detection

- [ ] **Step 8: Run the contract test again**

Run: `pnpm test -- tests/launch-p0/launch-observability-contract.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add docs/runbooks/launch-observability.md src/lib/observability/metrics.ts src/app/app/page.tsx src/app/app/p/[projectId]/page.tsx src/components/chat/ChatPanel.tsx src/components/share/PublishForm.tsx src/components/pricing/CheckoutDialog.tsx src/app/app/profile/page.tsx tests/launch-p0/launch-observability-contract.test.ts
git commit -m "chore: add launch observability baseline"
```

### Task 15: Verify and fix auth and publish dialog accessibility

**Files:**
- Modify: `src/components/auth/AuthDialog.tsx`
- Modify: `src/components/share/PublishForm.tsx`
- Modify: `docs/release-public-launch-checklist.md`

- [ ] **Step 1: Verify `AuthDialog` against the launch-floor checklist**

Check in the running app that the auth dialog:
- opens with focus inside the dialog
- can be closed by keyboard and close button/overlay path
- keeps email, password, and submit controls keyboard reachable
- exposes visible labels for email and password

- [ ] **Step 2: Fix `src/components/auth/AuthDialog.tsx` if any of the Step 1 checks fail**

Only fix the specific failed checklist items above.

- [ ] **Step 3: Verify `PublishForm` against the launch-floor checklist**

Check in the running app that the publish dialog:
- opens with focus inside the dialog
- exposes a close path
- keeps title, category, cover, and publish/update actions keyboard reachable
- exposes visible labels or equivalent accessible labels for its inputs

- [ ] **Step 4: Fix `src/components/share/PublishForm.tsx` if any of the Step 3 checks fail**

Only fix the specific failed checklist items above.

- [ ] **Step 5: Update `docs/release-public-launch-checklist.md`**

Add pass/fail rows for:
- auth dialog focus and close path
- auth dialog labeled inputs
- publish dialog focus and close path
- publish dialog labeled inputs

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/AuthDialog.tsx src/components/share/PublishForm.tsx docs/release-public-launch-checklist.md
git commit -m "fix: verify auth and publish dialog accessibility"
```

### Task 16: Verify and fix detail, checkout, and insufficient-points dialog accessibility

**Files:**
- Modify: `src/components/discover/PublicationDetailDialog.tsx`
- Modify: `src/components/pricing/CheckoutDialog.tsx`
- Modify: `src/components/points/InsufficientPointsDialog.tsx`
- Modify: `docs/release-public-launch-checklist.md`

- [ ] **Step 1: Verify `PublicationDetailDialog` against the launch-floor checklist**

Check in the running app that the detail dialog:
- opens with focus inside the dialog
- exposes a close path
- keeps remix/interaction actions keyboard reachable
- remains usable without trapping the user on smaller screens

- [ ] **Step 2: Fix `src/components/discover/PublicationDetailDialog.tsx` if any of the Step 1 checks fail**

Only fix the specific failed checklist items above.

- [ ] **Step 3: Verify `CheckoutDialog` against the launch-floor checklist**

Check in the running app that the checkout dialog:
- opens with focus inside the dialog
- exposes a close path during channel, processing, polling, success, and failure states
- keeps payment actions keyboard reachable
- exposes visible text for the current state

- [ ] **Step 4: Fix `src/components/pricing/CheckoutDialog.tsx` if any of the Step 3 checks fail**

Only fix the specific failed checklist items above.

- [ ] **Step 5: Verify `InsufficientPointsDialog` against the launch-floor checklist**

Check in the running app that the insufficient-points dialog:
- opens with focus inside the dialog
- exposes a close path
- keeps later/upgrade actions keyboard reachable
- does not hide the primary purchase handoff behind an inaccessible control

- [ ] **Step 6: Fix `src/components/points/InsufficientPointsDialog.tsx` if any of the Step 5 checks fail**

Only fix the specific failed checklist items above.

- [ ] **Step 7: Update `docs/release-public-launch-checklist.md`**

Add pass/fail rows for:
- detail dialog focus and close path
- checkout dialog focus and close path
- insufficient-points dialog focus and close path

- [ ] **Step 8: Commit**

```bash
git add src/components/discover/PublicationDetailDialog.tsx src/components/pricing/CheckoutDialog.tsx src/components/points/InsufficientPointsDialog.tsx docs/release-public-launch-checklist.md
git commit -m "fix: verify detail and payment dialog accessibility"
```

### Task 17: Verify and fix landing, auth, and app-home mobile widths

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/auth/page.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`

- [ ] **Step 1: Verify `/`, `/auth`, and `/app` at 375px width**

Record for each page whether:
- horizontal overflow occurs
- the primary CTA remains visible without sideways scrolling
- the first primary action remains usable

- [ ] **Step 2: Fix `src/app/page.tsx`, `src/app/auth/page.tsx`, and `src/app/app/page.tsx` only where Step 1 fails**

Keep scope tight. Do not redesign the pages.

- [ ] **Step 3: Verify the same three pages at 430px width**

Confirm the fixes also hold at the larger common mobile width.

- [ ] **Step 4: Update `docs/release-public-launch-checklist.md` and `docs/release-public-launch-go-no-go.md`**

Record pass/fail for landing, auth, and app-home mobile checks.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/auth/page.tsx src/app/app/page.tsx docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md
git commit -m "fix: verify mobile launch floor for core entry pages"
```

### Task 18: Verify and fix discover, pricing, profile, and legal reachability

**Files:**
- Modify: `src/app/app/discover/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`

- [ ] **Step 1: Verify `/app/discover`, `/pricing`, and `/app/profile` at 375px width**

Record for each page whether:
- horizontal overflow occurs
- the primary action or primary content remains usable
- the page can be completed without sideways scrolling

- [ ] **Step 2: Fix `src/app/app/discover/page.tsx`, `src/app/pricing/page.tsx`, and `src/app/app/profile/page.tsx` only where Step 1 fails**

Keep scope tight. Do not redesign the pages.

- [ ] **Step 3: Verify terms/privacy reachability from public-facing surfaces**

Confirm terms and privacy remain reachable from public-facing UI and update `src/app/layout.tsx`, `src/app/terms/page.tsx`, or `src/app/privacy/page.tsx` only if needed.

- [ ] **Step 4: Update `docs/release-public-launch-checklist.md` and `docs/release-public-launch-go-no-go.md`**

Record:
- discover/pricing/profile mobile pass/fail
- public legal reachability pass/fail
- any launch blocker discovered during the audit

- [ ] **Step 5: Commit**

```bash
git add src/app/app/discover/page.tsx src/app/pricing/page.tsx src/app/app/profile/page.tsx src/app/layout.tsx src/app/terms/page.tsx src/app/privacy/page.tsx docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md
git commit -m "fix: verify mobile discovery and public legal reachability"
```

### Task 19: Run final verification and checkpoint remaining blockers

**Files:**
- Modify: `docs/release-public-launch-checklist.md`
- Modify: `docs/release-public-launch-go-no-go.md`

- [ ] **Step 1: Run the targeted contract suite**

Run:
```bash
pnpm test -- tests/launch-p0/release-gates-contract.test.ts tests/launch-p0/editor-route-fallbacks-contract.test.ts tests/launch-p0/core-entry-contract.test.ts tests/launch-p0/editor-recovery-contract.test.ts tests/launch-p0/commercial-trust-contract.test.ts tests/launch-p0/invite-and-entitlement-contract.test.ts tests/launch-p0/payment-route-contract.test.ts tests/launch-p0/publish-flow-contract.test.ts tests/launch-p0/discover-route-fallback-contract.test.ts tests/launch-p0/discovery-sharing-contract.test.ts tests/launch-p0/launch-observability-contract.test.ts
```
Expected: PASS

- [ ] **Step 2: Run full verification**

Run:
```bash
node scripts/verify-launch-env.mjs && pnpm lint && pnpm test && pnpm build
```
Expected: PASS

- [ ] **Step 3: Confirm all smoke docs have been executed**

Check that:
- `docs/smoke/core-creation.md`
- `docs/smoke/commercial-trust.md`
- `docs/smoke/discovery-sharing.md`

have all been run and their results recorded.

- [ ] **Step 4: Finalize checklist and go/no-go note**

Record:
- what is now automated
- what remains manual
- launch observability verification result
- any unresolved launch blockers
- final `go` / `no-go` / `hold` recommendation

- [ ] **Step 5: Commit**

```bash
git add docs/release-public-launch-checklist.md docs/release-public-launch-go-no-go.md docs/release-public-launch-go-no-go.md docs/smoke/core-creation.md docs/smoke/commercial-trust.md docs/smoke/discovery-sharing.md
git commit -m "docs: finalize public launch verification"
```

---

## Execution Notes

- Follow TDD for each task in order.
- Prefer minimal code changes inside existing files over new abstractions.
- Reuse existing Sonner infrastructure in `src/app/layout.tsx` for launch-facing feedback.
- Reuse existing `src/lib/observability/*` helpers for operator-visible launch events.
- Use contract tests for structural launch rules and smoke docs for runnable user-loop validation.
- Do not introduce Playwright in this plan.
- Do not invent new Supabase migrations or Edge Functions while executing this plan; if the assessment above proves wrong, stop and record the blocker first.

## Checkpoints

- **Checkpoint A — release-safe repo:** Task 1 complete
- **Checkpoint B — trustworthy creation core:** Tasks 2–5 complete
- **Checkpoint C — trustworthy money movement:** Tasks 6–9 complete
- **Checkpoint D — credible public loop:** Tasks 10–13 complete
- **Checkpoint E — launch floor and go/no-go:** Tasks 14–17 complete
