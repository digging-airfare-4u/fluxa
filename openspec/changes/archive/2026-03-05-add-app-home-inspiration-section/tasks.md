## 1. Homepage inspiration data integration

- [x] 1.1 Add homepage state in `src/app/app/page.tsx` for inspiration items, loading state, and fetch-failure fallback state.
- [x] 1.2 Implement inspiration data loading on `/app` using `fetchGalleryPublications` with latest ordering and a bounded preview limit.
- [x] 1.3 Ensure inspiration fetch runs independently so homepage core flows (prompt input, project creation, recent projects) remain functional when inspiration fetch fails.

## 2. Inspiration section UI on `/app`

- [x] 2.1 Add a new "灵感 / 最近发现" section below the existing recent projects section in `src/app/app/page.tsx`.
- [x] 2.2 Render loading placeholder/skeleton UI for the inspiration section while data is being fetched.
- [x] 2.3 Render preview cards for fetched items by reusing discover publication card presentation/pattern.
- [x] 2.4 Add section-level "查看全部" action that routes to `/app/discover`.

## 3. Empty/error behavior and navigation

- [x] 3.1 Add empty-state presentation when latest discover feed returns zero items, while keeping discover entry action available.
- [x] 3.2 Add non-blocking fallback behavior for inspiration fetch failures (section-level fallback only, no page-blocking error).
- [x] 3.3 Verify preview item click navigation goes to `/app/discover/{publicationId}`.

## 4. Verification and regression checks

- [x] 4.1 Validate `/app` renders section ordering correctly: quick tags → recent projects → inspiration section.
- [x] 4.2 Validate inspiration preview shows latest public discover items with bounded count.
- [x] 4.3 Validate navigation paths: section "查看全部" to `/app/discover`, card click to detail route.
- [x] 4.4 Validate degraded scenarios: loading, empty results, and fetch failure do not break existing homepage interactions.
