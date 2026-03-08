## Context

The editor currently supports dropping image URLs onto canvas, but dropping local files does not complete the expected user flow of upload + persisted canvas insertion. The existing canvas pipeline already has key reusable pieces: drag/drop coordinate conversion in `CanvasStage`, loading placeholders via `usePlaceholderManager`, and unified op persistence through `OpsPersistenceManager.addImage`. Storage and metadata conventions are already documented around COS-backed asset paths and `assets` records.

This change spans frontend interaction, upload API behavior, and asset persistence, and needs explicit technical decisions to keep UX responsive while preserving consistency in persisted ops.

## Goals / Non-Goals

**Goals:**
- Support local file drag-and-drop for both single and multiple image files.
- Provide immediate visual feedback at drop time via per-file loading placeholders.
- Upload dropped images to persistent storage and create `assets` records (`type = upload`, `metadata.source.origin = user_upload`).
- Apply client-side compression only when configured thresholds are exceeded.
- Insert uploaded images using the existing unified persistence path (`OpsPersistenceManager.addImage`) so canvas state survives reload and replay.
- Ensure per-file lifecycle correctness: each placeholder is always removed on success or failure.

**Non-Goals:**
- Redesigning non-drag import flows (menu import button behavior can remain unchanged for this change).
- Introducing batch transactions across all files in one drop (partial success is acceptable).
- Adding advanced media processing pipelines (e.g., EXIF orientation repair beyond current browser decode behavior, AI upscaling, dedup).
- Changing unrelated capabilities (e.g., payments or home feed behavior).

## Decisions

### 1) Keep canvas insertion on the existing op persistence path
- **Decision:** All successful uploads are inserted via `OpsPersistenceManager.addImage` rather than a separate direct-canvas path.
- **Why:** This keeps history/replay/persistence semantics unified and avoids divergence between drag-drop and other image insertion paths.
- **Alternatives considered:**
  - Directly `canvas.add()` then separately persist: rejected due to race conditions and duplicated logic.
  - New dedicated drag-drop persistence module: rejected as unnecessary abstraction for current scope.

### 2) Use per-file placeholder lifecycle tied to upload completion
- **Decision:** Create one placeholder per image immediately after drop position is computed; remove it in a `finally` path for each file.
- **Why:** Matches desired UX (“drop then loading mask”) and prevents orphan placeholders.
- **Alternatives considered:**
  - Single global loading overlay: rejected because it cannot represent per-file progress/failure.
  - Placeholder only after compression starts: rejected because it delays immediate visual feedback.

### 3) Conditional compression on client before upload
- **Decision:** Compress only if file exceeds either size threshold or max dimension threshold.
- **Why:** Preserves quality and CPU for normal images while controlling oversized uploads.
- **Policy:** thresholds are environment-configurable with required defaults: trigger if `size > 10MB` OR `max(width, height) > 4096`; target WebP/JPEG at tuned quality.
- **Alternatives considered:**
  - Always compress: rejected due to unnecessary latency and quality loss for small assets.
  - No compression: rejected because oversized images degrade upload reliability and quota usage.

### 4) Add authenticated upload API for drag-drop ingestion
- **Decision:** Introduce a dedicated upload endpoint for dropped files that handles auth, validation, strict quota pre-check enforcement, COS upload, and `assets` insert, returning canonical URL/metadata.
- **Why:** Centralizes trust boundaries and keeps client logic focused on UX + orchestration.
- **Alternatives considered:**
  - Client direct upload to COS with temporary credentials: rejected for current scope due to complexity and key management.
  - Reuse unrelated existing API routes: rejected due to mismatched request/response contracts.

### 5) Multi-file processing with bounded concurrency and independent outcomes
- **Decision:** Process multiple dropped images with bounded concurrency (default pool size = 3, environment-configurable), preserving per-file success/failure and continuing after individual failures.
- **Why:** Avoids browser/network saturation while meeting “single + multi-image both supported” requirement.
- **Alternatives considered:**
  - Fully sequential: rejected (slow for multi-file drops).
  - Unbounded parallel: rejected (higher chance of spikes/timeouts/UI jank).

## Risks / Trade-offs

- **[Risk] Client-side compression may cause UI jank on very large images** → **Mitigation:** bounded concurrency, async blob conversion, and conservative thresholds.
- **[Risk] Upload API failure can leave user uncertain which files succeeded** → **Mitigation:** per-file toast/error messaging and independent completion handling.
- **[Risk] Placeholder/object position mismatch in multi-file drop** → **Mitigation:** deterministic offset strategy from initial drop point and use final computed coordinates for insertion.
- **[Risk] Path/metadata inconsistency between API and existing asset consumers** → **Mitigation:** enforce existing storage path conventions and return URL format consumed by current asset utilities.
- **[Trade-off] Partial success is allowed** (some files succeed, others fail) → improves resilience but requires clear feedback.

## Migration Plan

1. Add upload API endpoint and validate contract locally (auth, file validation, COS upload, `assets` insert).
2. Update `CanvasStage` drag-drop path to detect `DataTransfer.files` first, then URL fallback behavior.
3. Integrate per-file placeholder lifecycle and conditional compression in frontend flow.
4. Route successful results through `OpsPersistenceManager.addImage`.
5. Add i18n/error messaging for skipped non-image, oversize-after-compress, upload failure.
6. Verify with manual scenarios: single small, single large(compress), multi mixed, network/auth failure, page reload persistence.

**Rollback strategy:**
- Revert frontend drag-file branch while preserving existing URL-drop behavior.
- Keep upload endpoint unused (or disable route) if backend instability appears.

## Open Questions

- Do we require strict quota check enforcement in this endpoint immediately, or can it rely on existing DB-level controls and add explicit pre-check later?

## Resolved Decisions

- **Compression threshold source:** thresholds are environment-configurable from day one with required defaults.
- **Non-image feedback granularity:** use one aggregate toast per drop for unsupported files, including skipped count.

## Change Notes (Verification Evidence for 5.1–5.5)

### Verification command
- `pnpm vitest --run tests/canvas-drag-upload/upload-route-contract.test.ts tests/canvas-drag-upload/canvas-drop-contract.test.ts tests/canvas-drag-upload/drop-compression-contract.test.ts tests/canvas-drag-upload/drop-feedback-leak-contract.test.ts`
- Result: **4 files passed, 12 tests passed, 0 failed**.

### Scenario outcomes
- **5.1 Single-image drop flow**
  - Evidence: `tests/canvas-drag-upload/canvas-drop-contract.test.ts`
  - Outcome: Verified placeholder creation/removal, upload call, position resolution, and insertion via `persistenceManager.addImage`.
- **5.2 Multi-image mixed outcomes**
  - Evidence: `tests/canvas-drag-upload/canvas-drop-contract.test.ts`
  - Outcome: Verified per-file task mapping, unsupported-file skip path, and independent `finally` cleanup for each file.
- **5.3 Compression threshold behavior**
  - Evidence: `tests/canvas-drag-upload/drop-compression-contract.test.ts`
  - Outcome: Verified threshold gates, conditional compression path, and upload using `uploadFile` (compressed or original).
- **5.4 Fallback compatibility**
  - Evidence: `tests/canvas-drag-upload/canvas-drop-contract.test.ts`
  - Outcome: Verified URL/text drop fallback remains; verified non-drag toolbar import flow remains intact in `src/components/editor/EditorLayout.tsx`.
- **5.5 Change-note handoff evidence**
  - Outcome: This section documents scenarios + outcomes and associated verification command/results for implementation handoff.