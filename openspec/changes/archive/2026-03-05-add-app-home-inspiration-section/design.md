## Context

`/app` is the primary entry page for authenticated creation flow and currently focuses on prompt entry plus recent project management. Discovery content exists in `/app/discover` and already has a mature data/query path (`fetchGalleryPublications`) and card UI (`PublicationCard`), but users must explicitly navigate there to see public inspiration.

Constraints:
- Keep homepage fast and lightweight.
- Avoid introducing new backend endpoints or schema changes for this iteration.
- Preserve existing `/app` behavior (project creation, quick tags, recent projects) without functional regression.

Stakeholders:
- End users who want inspiration without leaving home.
- Product/UX wanting stronger discovery exposure on first screen.
- Engineering maintaining discover + homepage consistency with minimal duplication.

## Goals / Non-Goals

**Goals:**
- Add a "灵感 / 最近发现" preview section below recent projects on `/app`.
- Show latest public publications from existing discover feed.
- Reuse existing publication card patterns to keep visuals/interactions consistent.
- Provide a clear navigation path to full discover experience (`/app/discover`).
- Define resilient UX for loading, empty, and fetch-failure states.

**Non-Goals:**
- Build a personalized recommendation/ranking engine.
- Port full discover filtering/search/sort controls into `/app`.
- Introduce new database tables, RPCs, or API routes.
- Redesign discover card semantics beyond homepage-specific sizing/layout needs.

## Decisions

### 1) Data source: reuse `fetchGalleryPublications` with latest sort
**Decision:** Use existing `fetchGalleryPublications({ sortBy: 'latest', limit: <small number> })` directly from homepage.

**Rationale:**
- Lowest implementation risk and fastest integration.
- Guarantees consistency with discover data eligibility rules.
- Avoids backend changes and migration overhead.

**Alternatives considered:**
- New homepage-specific RPC/API for curated feed: rejected as premature complexity.
- Personalized feed based on user interactions: rejected for this scope; can be future iteration.

### 2) UI composition: add a dedicated homepage section under recent projects
**Decision:** Introduce a new section after recent projects with title/subtitle, preview cards, and "查看全部" action.

**Rationale:**
- Matches user request (scroll-down content expansion on `/app`).
- Keeps recent projects as primary, inspiration as secondary discovery block.
- Minimal disruption to current layout hierarchy.

**Alternatives considered:**
- Insert above recent projects: rejected; would dilute core creation/project workflow.
- Replace recent projects area: rejected; removes high-value existing function.

### 3) Card reuse strategy: reuse discover card UI with homepage constraints
**Decision:** Reuse existing publication card component/pattern (`PublicationCard`) for consistency, while keeping homepage list length small (e.g., 6–8 items).

**Rationale:**
- Prevents duplicate rendering logic and inconsistent interaction behavior.
- Lowers maintenance cost when discover card evolves.

**Alternatives considered:**
- Build a separate slim card for home: rejected for now to avoid duplicate display contracts.

### 4) Failure handling: non-blocking degradation
**Decision:** If inspiration fetch fails, do not fail `/app`; show a lightweight fallback/empty state and keep core homepage flows functional.

**Rationale:**
- `/app` is mission-critical for creation and project access.
- Discovery is additive; failure should not block core actions.

**Alternatives considered:**
- Global error banner for page-level failure: rejected as too disruptive for secondary content.

## Risks / Trade-offs

- **[Risk] Additional homepage query increases initial render work** → **Mitigation:** keep result size small and avoid expensive transformations.
- **[Risk] Reusing discover card might feel visually heavy on home** → **Mitigation:** constrain card count and spacing; tune section styling only.
- **[Risk] Empty/failure states reduce perceived value if frequent** → **Mitigation:** explicit fallback copy + "查看全部" link to recover user path.
- **[Trade-off] Latest-only feed may not maximize engagement vs personalized** → **Mitigation:** defer personalization as future enhancement once baseline integration is validated.

## Migration Plan

- No schema/data migration required.
- Rollout via standard frontend deploy.
- Rollback strategy: revert homepage section changes only; discover subsystem remains unchanged.

## Open Questions

- Should preview size be 6 or 8 cards for best fold/performance balance on common desktop widths?
- Should homepage preview always use `latest`, or expose a future product toggle for `popular`?
- Should we show category badge/tag in home preview cards now, or keep parity with current card baseline only?
