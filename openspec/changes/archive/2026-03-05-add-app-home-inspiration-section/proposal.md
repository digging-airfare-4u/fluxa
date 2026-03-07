## Why

The `/app` homepage currently ends with quick actions and recent projects, but does not surface community inspiration content. Adding a lightweight "灵感 / 最近发现" section helps users discover fresh public works without leaving home, improving exploration and engagement at the first touchpoint.

## What Changes

- Add a new inspiration preview section below recent projects on `/app`.
- Show latest public discover publications (global feed) in a compact homepage preview list/grid.
- Add a "查看全部" entry point from `/app` to `/app/discover`.
- Reuse existing discover publication card presentation to keep interaction and visual patterns consistent.
- Define homepage behavior for loading, empty, and fetch-failure states for this section.

## Capabilities

### New Capabilities
- `app-home-inspiration-feed`: Expose a homepage-level preview feed of latest public discover items, with clear navigation to full discover browsing.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/app/app/page.tsx` and shared discover/home presentation components as needed.
- Data path: reuses existing publication queries (latest public discover feed), no new external service dependency required.
- UX impact: homepage gains a second content section focused on discovery; existing project-related flows remain unchanged.
- APIs/systems: no breaking API changes expected.
