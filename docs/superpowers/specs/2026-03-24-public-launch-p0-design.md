# Fluxa Public Launch P0 Design

- **Date:** 2026-03-24
- **Status:** Draft for review
- **Scope:** Public launch readiness
- **Primary launch assumption:** Fluxa launches publicly with three stable user-facing pillars: AI creation/editing, discovery/sharing, and paid conversion.

## 1. Context

Fluxa already has substantial product surface area in place: AI-assisted creation, editor/canvas workflows, discovery/sharing, social interactions, payments, invite codes, and provider/model configuration. The main gap is no longer feature existence; it is launch-grade completion.

The current P0 problem is therefore not “what new features should be built,” but “what must be tightened so the existing product can be trusted by public users.”

This design groups P0 work by launch capability rather than by page or technical subsystem so that implementation planning stays aligned to public-launch risk.

## 2. Launch Goal

Before public launch, Fluxa must satisfy four user expectations:

1. **The product ships safely** — broken builds are blocked before release.
2. **A user can complete a real creative workflow** — from entry to creation to return usage.
3. **Public content can be published, consumed, and remixed** — discovery acts as a real growth loop.
4. **Users can pay, receive value, and trust the ledger** — commercial flows are transparent and stable.

## 3. Design Principles

### 3.1 Capability-first packaging
P0 work is grouped by launch capability, not by page or engineering specialty.

### 3.2 Closed-loop thinking
Each package must define a complete user loop. A partially implemented page or API does not count as launch-ready if the user cannot confidently finish the intended action.

### 3.3 Trust before polish
P0 prioritizes reliability, feedback, and recoverability over additional breadth.

### 3.4 Explicit exclusions
Each package defines what it does **not** include so P0 does not expand into a general product maturity program.

## 4. P0 Package Structure

```text
P0
├── Package 1: Release Gates
├── Package 2: Core Creation Loop
├── Package 3: Discovery & Sharing Loop
└── Package 4: Commercial Trust Loop
```

## 5. Recommended Execution Order

1. **Package 1: Release Gates**
2. **Package 2: Core Creation Loop**
3. **Package 4: Commercial Trust Loop**
4. **Package 3: Discovery & Sharing Loop**

### Why this order

- Release gates reduce risk for every later change.
- The creation loop is the product’s value core and must be trustworthy before growth work matters.
- Commercial trust must be solid before broad public conversion pressure.
- Discovery/sharing is still **required before public launch**, but it can be finalized after core creation and payment confidence are no longer fragile.

## 6. Minimum Launch Floor

These non-functional bars apply across all packages.

### 6.1 UX responsiveness
- The routes `/`, `/app`, `/app/discover`, and `/app/p/[projectId]` must show a visible loading or skeleton state instead of a blank screen when data is pending.
- No primary route should leave the user on an unexplained blank state after navigation.

### 6.2 Accessibility baseline
- Primary CTAs must be keyboard reachable.
- Dialogs used for auth, publish, detail, and checkout must trap focus and expose a close path.
- Form inputs used in auth, publish, checkout, and invite redemption must have visible labels or equivalent accessible labels.

### 6.3 Mobile baseline
- Landing, app home, discover, auth, pricing, profile, and checkout flows must be usable without horizontal overflow on common mobile widths.

### 6.4 Security/privacy baseline
- Auth is required for project creation, publishing, checkout, and invite redemption.
- No client-visible flow may expose internal secret material or service-role behavior.
- Terms and privacy pages must remain reachable from public-facing surfaces.

### 6.5 Observability baseline
At minimum, launch must allow the operator to identify failures in these events:
- project creation
- editor load
- AI generation failure
- publish failure
- checkout failure
- payment success
- invite redemption failure

### 6.6 Manual operations baseline
- A release checklist must exist.
- A payment issue runbook must exist.
- A manual public-content hide/takedown fallback must exist.

## 7. Shared Systems Dependency Matrix

| Shared system | Package 1 | Package 2 | Package 3 | Package 4 |
|---|---:|---:|---:|---:|
| Auth/session state | ✓ | ✓ | ✓ | ✓ |
| Project creation and persistence |  | ✓ | ✓ (remix target) | ✓ (post-purchase return-to-use) |
| AI jobs/providers |  | ✓ | ✓ (remix source/derived prompt) | ✓ (points-gated usage) |
| Publication model/status |  |  | ✓ |  |
| Points/membership ledger |  | ✓ (usage gating) |  | ✓ |
| Payment/order state |  |  |  | ✓ |
| Supabase migrations/functions | ✓ | ✓ | ✓ | ✓ |
| User-facing loading/error rules | ✓ | ✓ | ✓ | ✓ |
| Smoke/E2E verification suite | ✓ | ✓ | ✓ | ✓ |

## 8. Package 1 — Release Gates

### 8.1 Objective
Prevent obviously broken versions from reaching public users.

### 8.2 Included scope
- Add baseline CI for:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Define release quality gates.
- Define a public-launch release checklist.
- Validate critical environment/config assumptions before release.

### 8.3 Likely implementation surfaces
- `.github/workflows/*`
- `package.json`
- release checklist under `docs/`
- any environment validation helper or release script introduced for launch

### 8.4 Concrete outputs
- A CI workflow that runs on pull requests targeting `main`.
- A CI workflow or equivalent required check that runs on pushes to `main`.
- A release checklist document with named items and pass/fail completion boxes.
- A short launch go/no-go template naming the release owner.

### 8.5 Release enforcement and ownership
- **Required trigger points:** PR to `main`, push to `main`, and the final public-launch cut.
- **Required checks:** lint, tests, production build.
- **Required operator role:** one named **release owner** for each launch attempt. In a solo workflow, this is the repo owner.
- **Go/no-go signoff:** release owner confirms CI is green and checklist items are complete.
- **Configuration validation list:** verify presence and correctness of at least
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL`
  - required payment/provider secrets documented in README/Supabase configuration

### 8.6 Current repo evidence
- Existing scripts are available in `package.json`.
- No `.github/workflows` directory was found during repo inspection.

### 8.7 Known gaps and open questions
- Branch protection status is unknown from repo inspection.
- No explicit release checklist document was found.
- No visible CI signal exists for migrations/functions or deployment readiness.

### 8.8 Acceptance criteria
- A PR to `main` automatically runs lint, tests, and production build.
- A push to `main` automatically runs lint, tests, and production build.
- Public launch may not proceed unless all three checks are green.
- The release checklist includes, at minimum:
  - core creation smoke passed
  - discovery/remix smoke passed
  - checkout/invite smoke passed
  - required env/config verified
  - migration/function changes reviewed
- A named release owner can execute the launch process without relying on undocumented memory.

### 8.9 Key risks if omitted
- Silent regressions across editor, discovery, or payments.
- Shipping broken routes or API changes accidentally.
- Migration/function changes drifting into production without clear verification.

## 9. Package 2 — Core Creation Loop

### 9.1 Objective
Ensure a new or returning user can complete a full AI creation workflow and continue working without confusion.

### 9.2 Canonical P0 creative path

The canonical public-launch path is:

```text
Unauthenticated visitor lands on /
→ chooses CTA
→ completes auth if needed
→ lands on /app
→ enters a prompt in HomeInput
→ project is created
→ browser opens /app/p/[projectId]?prompt=...
→ editor loads project, document, and conversation
→ the initial prompt is submitted into the editor/chat workflow
→ at least one visible canvas change is produced and persisted
→ user leaves editor
→ user reopens the same project from /app recent projects
→ the same work is restored and can continue
```

### 9.3 Supported P0 entry points
- `/` landing CTA
- `/auth`
- `/app` new project via prompt
- `/app` new empty project
- `/app` recent projects re-entry

### 9.4 Success definition
A creation session counts as successful only if all of the following are true:
- the user reaches the editor with a valid `project`, `document`, and `conversation`
- the user receives visible generation feedback
- at least one user-visible canvas result is created
- the result persists across reload or re-entry

### 9.5 Required user-visible states
The creation loop must explicitly handle these user-visible states:
- creating project
- create project failed
- loading editor
- project missing or inaccessible
- project data incomplete
- generation submitted
- generation in progress
- generation failed
- persistence/save failed
- project reopened successfully

### 9.6 Included scope
- Entry clarity across landing, auth, and app home.
- Stable project creation for both empty and prompt-seeded starts.
- Editor first-load reliability and recoverable error states.
- Clear AI generation feedback and result visibility.
- Reliable persistence so users can return to projects.
- Smoke coverage for the end-to-end creative path.

### 9.7 Likely implementation surfaces
- `src/app/page.tsx`
- `src/app/auth/page.tsx`
- `src/app/app/page.tsx`
- `src/app/app/p/[projectId]/page.tsx`
- `src/components/editor/EditorLayout.tsx`
- `src/components/chat/*`
- `src/components/canvas/CanvasStage.tsx`
- project/editor data-fetching and persistence queries in `src/lib/supabase/queries/*`

### 9.8 Concrete outputs
- A documented primary creative path.
- Route-level or page-level loading/error handling for core creation surfaces.
- A defined set of user-facing error and retry rules for project creation and generation.
- Smoke/E2E scenarios for:
  - `auth_to_first_generation`
  - `empty_project_to_editor`
  - `return_to_existing_project`
  - `generation_failure_feedback`

### 9.9 Named failure modes that must be handled
- auth expired before or during creation
- create-project request failure
- orphan project created without complete document/conversation data
- editor load failure
- missing project / unauthorized project access
- AI provider/model failure
- AI generation timeout
- network loss during generation
- ops fetch/replay failure
- realtime disconnect during active session
- persistence/save failure after generation

### 9.10 Current repo evidence
- Landing CTA exists in `src/app/page.tsx`.
- Auth entry exists in `src/app/auth/page.tsx`.
- App home creation flows exist in `src/app/app/page.tsx`.
- Editor bootstrapping exists in `src/app/app/p/[projectId]/page.tsx`.
- Editor composition exists in `src/components/editor/EditorLayout.tsx`.
- Canvas feedback TODOs remain in `src/components/canvas/CanvasStage.tsx`.

### 9.11 Known gaps and open questions
- Route-level `loading.tsx` / `error.tsx` coverage is not visible in `src/app`.
- Some critical failure feedback still appears to rely on console logging or TODO placeholders.
- The exact user-facing failure treatment for provider errors and timeouts needs to be standardized.

### 9.12 Acceptance criteria
- A first-time user can complete the canonical P0 creative path end-to-end.
- An empty-project path can open the editor without broken state.
- A returning user can reopen a recent project and see prior canvas state restored.
- Missing or incomplete project data results in a visible recovery UI with at least one clear return path.
- Generation failure produces visible user feedback in the same session; failure may not be console-only.
- At least the four named smoke scenarios in section 9.8 are documented and runnable before launch.

### 9.13 Key risks if omitted
- Public users perceive the product as impressive but unreliable.
- First-use friction destroys activation.
- Returning users lose confidence if state recovery is inconsistent.

## 10. Package 3 — Discovery & Sharing Loop

### 10.1 Objective
Turn completed work into public content that can be published, browsed, understood, and remixed back into creation.

### 10.2 Public-launch sequencing rule
Package 3 may be stabilized later than Packages 1, 2, and 4, but it is still **required before public launch**. Public launch is not complete if discovery exists only as a partially credible demo surface.

### 10.3 Minimum viable discovery bar
Before launch, discovery must support all of the following:
- creators can publish a work with required metadata
- visitors can browse a stable discover feed
- visitors can open a detail view with enough metadata to understand the work
- visitors can use at least one reliable interaction path
- visitors can remix from discovery back into the editor
- only intentionally public content appears in discover

### 10.4 User loops covered

#### Loop A — creator publishes
```text
Editor → publish → set cover/title/category/description → publish succeeds → content appears in discover
```

#### Loop B — visitor discovers
```text
/app/discover → browse cards → open detail → understand content → interact or remix
```

#### Loop C — remix returns to creation
```text
discover/detail → remix → create new project → open editor with remix context
```

### 10.5 Required public metadata
At minimum, a public work must provide:
- cover image
- title
- category
- creator identity display
- sufficient description or contextual text for the detail view

### 10.6 Required detail-view content
The detail surface must expose, at minimum:
- cover/media
- title
- creator
- category
- description/context
- primary remix action
- visible interaction section

### 10.7 Remix context requirements
A discovery remix must carry enough context into the new editor session to explain why the project exists. At minimum this includes:
- source entry (`discover`)
- source publication identifier/reference
- the derived remix prompt
- the new target project identifier after creation

### 10.8 Included scope
- Reliable publish flow and update flow.
- Discover feed stability and explicit loading/empty/error states.
- Detail view clarity and stable navigation state.
- Minimum viable social interactions that are recoverable.
- Stable remix path from discovery back into editor.
- Minimum public-content quality bar.
- Smoke validation for publish → discover → detail → remix.

### 10.9 Likely implementation surfaces
- `src/components/share/PublishForm.tsx`
- `src/app/app/discover/page.tsx`
- `src/components/discover/*`
- `src/components/social/*`
- publication and social queries in `src/lib/supabase/queries/*`
- remix utilities used by discover/detail flows

### 10.10 Concrete outputs
- Publish validation rules and public metadata rules.
- Defined loading/empty/error states for discover and detail.
- Growth-loop smoke/E2E scenarios for:
  - `publish_new_work`
  - `browse_discover_detail`
  - `remix_back_to_editor`
  - `interaction_requires_auth`
- A short public-content moderation fallback note in launch docs.

### 10.11 Minimal moderation and safety boundary
P0 does **not** require a full moderation back office, but it does require a baseline public-content safety rule:
- only explicit public/published works appear in discover
- hidden works must be excluded from discover
- the operator must have a documented manual hide/takedown path for abusive or broken public content

### 10.12 Current repo evidence
- Publish flow exists in `src/components/share/PublishForm.tsx`.
- Discover feed exists in `src/app/app/discover/page.tsx`.
- Detail dialog host exists in `src/components/discover/PublicationDetailDialog.tsx`.
- Comment interactions exist in `src/components/social/CommentSection.tsx`.
- Remix entry is wired in `src/app/app/discover/page.tsx`.

### 10.13 Known gaps and open questions
- Publish and comment flows still contain console-error-heavy behavior.
- Public moderation/abuse handling is not visible as a complete product surface.
- Detail is dialog-based; launch planning must decide whether dialog-only behavior is sufficient on all target devices.

### 10.14 Acceptance criteria
- A creator can publish a new work only when cover image, title, and category are present.
- A creator can update an existing public work without creating ambiguous duplicate behavior.
- Discover exposes explicit loading, empty, error, and no-more-results states.
- A discover card and detail view both expose enough information to identify the work and creator.
- Remix from either card or detail creates a new project and carries the context defined in section 10.7.
- At least the four named smoke scenarios in section 10.10 are documented and runnable before launch.

### 10.15 Key risks if omitted
- Discover feels decorative rather than real.
- The growth loop exists in UI but not in user experience.
- The strongest public-facing differentiator (remix back into creation) feels fragile.

## 11. Package 4 — Commercial Trust Loop

### 11.1 Objective
Ensure users can understand pricing, complete payment, receive value, and trust the relationship between points, membership, orders, and invite-based benefits.

### 11.2 Source-of-truth rules
Commercial state must be derived from server-authoritative records, not local assumptions.

- **Payment attempt state** comes from server-side order/payment status.
- **Points balance, membership level, and transaction history** come from server-side entitlement data.
- **Invite redemption** must refresh entitlement state from the server after success; the UI may not treat a local optimistic message as proof of arrival.
- If payment status and visible balance disagree, the UI must enter a named delayed-entitlement state instead of silently pretending the transaction is complete.

### 11.3 User loops covered

#### Loop A — pay after need is triggered
```text
AI usage / insufficient points → pricing/checkout → choose channel → pay → points/benefits arrive → continue using product
```

#### Loop B — inspect current value
```text
profile/pricing → view points, level, and transactions → understand current entitlement
```

#### Loop C — invite benefit redemption
```text
enter invite code → redeem → receive clear success/failure outcome → understand benefit change
```

### 11.4 Required payment and entitlement states
The commercial flow must explicitly handle these states:
- login required
- choose payment channel
- creating order
- awaiting external payment action
- awaiting confirmation/polling
- payment succeeded
- payment failed
- payment expired
- payment cancelled/closed
- delayed entitlement arrival
- retry available
- invite redeemed
- invite redeem failed

### 11.5 Included scope
- Trustworthy display of points, membership level, and recent transactions.
- Clear conversion path from need trigger to pricing to checkout.
- Checkout flow that is understandable, stateful, and recoverable.
- Reliable success-to-arrival feedback after payment.
- Clear relationship between AI usage and payment triggers.
- Invite code redemption with user-friendly outcomes.
- Validation of the commercial loop through smoke coverage.

### 11.6 Likely implementation surfaces
- `src/components/points/UserProfilePoints.tsx`
- `src/components/pricing/CheckoutDialog.tsx`
- pricing surfaces under `src/components/pricing/*` and `src/app/pricing/page.tsx`
- `src/app/app/pricing/page.tsx`
- `src/app/app/profile/page.tsx`
- payment and invite routes under `src/app/api/payments/*` and `src/app/api/invite/redeem/route.ts`

### 11.7 Concrete outputs
- Commercial state model and messaging rules.
- Checkout state rules for success/failure/timeout/delayed-entitlement.
- Smoke/E2E scenarios for:
  - `insufficient_points_to_checkout`
  - `checkout_success_updates_balance`
  - `checkout_timeout_recovery`
  - `invite_redeem_success_failure`
- User-facing copy rules for points, membership, and invite outcomes.

### 11.8 Current repo evidence
- Points profile exists in `src/components/points/UserProfilePoints.tsx`.
- Checkout exists in `src/components/pricing/CheckoutDialog.tsx`.
- App pricing route redirects to public pricing in `src/app/app/pricing/page.tsx`.
- Invite redemption exists in `src/app/app/profile/page.tsx`.
- Current invite success messaging still exposes internal-looking text in profile flow.

### 11.9 Known gaps and open questions
- Checkout currently depends on an external QR rendering service for at least one payment mode.
- The exact delayed-entitlement user message is not yet standardized.
- Invite redemption messaging still contains developer-facing/internal-looking language.

### 11.10 Acceptance criteria
- A user can identify what they are buying and why before starting checkout.
- Checkout exposes the named states in section 11.4 instead of collapsing all problems into a generic failure.
- After the server confirms payment, updated points or membership state must be visible in the product within one normal refresh cycle or the UI must enter a visible delayed-entitlement state with manual refresh guidance.
- Profile view must show current points balance, membership level, and transaction history without internal implementation language.
- Invite redemption success and failure messages are user-friendly and do not expose raw internal field names or codes.
- At least the four named smoke scenarios in section 11.7 are documented and runnable before launch.

### 11.11 Key risks if omitted
- Users distrust the ledger even if payments technically work.
- Payment support burden rises sharply due to unclear state transitions.
- Conversion drops because buying value feels confusing or unsafe.

## 12. Cross-Package Sequencing Checkpoints

The implementation plan must preserve these checkpoints:

1. **Checkpoint A — release-safe repo**
   - Package 1 acceptance criteria met.
2. **Checkpoint B — trustworthy creation core**
   - Package 2 smoke scenarios pass.
3. **Checkpoint C — trustworthy money movement**
   - Package 4 smoke scenarios pass.
4. **Checkpoint D — credible public loop**
   - Package 3 smoke scenarios pass.
5. **Checkpoint E — public launch ready**
   - All package acceptance criteria and launch-floor requirements pass.

## 13. Launch Readiness Definition

Fluxa is considered **P0-ready for public launch** only when all of the following are true:

1. **Release safety exists**
   - CI and release checklist are in place.
2. **The core creation loop is smoke-tested**
   - New users and returning users can complete the canonical workflow.
3. **Public sharing is credible**
   - Publish, discover, detail, and remix all meet the minimum viable discovery bar.
4. **Commercial trust is established**
   - Users can pay, see value arrive, and understand their entitlement state.
5. **Launch floor requirements are met**
   - UX, accessibility, security/privacy, observability, and manual operations baselines are satisfied.

## 14. What This Design Intentionally Does Not Solve

This design does not attempt to cover:
- long-term product growth strategy beyond launch
- full operational maturity for a scaled team
- advanced social/community systems
- premium analytics/attribution stack buildout
- deep content moderation programs
- full billing platform maturity

Those can follow after P0. This design is intentionally constrained to public-launch readiness.

## 15. Recommended Next Step

Translate these four packages into an implementation plan that preserves the package structure and includes, for each package:
- concrete tasks/workstreams
- expected files/systems to touch
- dependencies and ordering
- migrations/functions required
- verification commands/tests
- test ownership
- launch-blocking vs deferrable items
- checkpoint-based rollout order

The implementation plan should not flatten this into a generic backlog. It should retain the four-package launch structure so the work remains tied to public-launch risk.