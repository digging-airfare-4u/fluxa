## 1. Upload API and Asset Persistence Backend

- [x] 1.1 Add an authenticated upload endpoint for dropped images (e.g. `/api/assets/upload`) that accepts multipart form data (`projectId`, optional `documentId`, `file`).
- [x] 1.2 Implement server-side validation for MIME type and max accepted payload boundaries before storage write.
- [x] 1.3 Implement persistent storage upload path generation using existing asset path conventions and upload the file content via Edge shared asset service (`supabase/functions/_shared/services/asset.ts`).
- [x] 1.4 Insert `assets` metadata row for each successful upload with `type = upload`, ownership fields, and `metadata.source.origin = user_upload`.
- [x] 1.5 Return canonical response payload (`assetId`, `storagePath`, `url`, `mimeType`, `sizeBytes`, optional dimensions) and normalized error codes for frontend handling.
- [x] 1.6 Add Edge function `supabase/functions/upload-asset/index.ts` and route adapter mapping in `src/app/api/assets/upload/route.ts`.

## 2. Canvas Drag-Drop File Pipeline

- [x] 2.1 Update canvas drop handling to prioritize `DataTransfer.files` for local file drops while preserving current URL/text drop fallback behavior.
- [x] 2.2 Add multi-file processing orchestration with bounded concurrency and deterministic per-file placement offsets from the drop anchor.
- [x] 2.3 Integrate per-file placeholder lifecycle: create placeholder immediately on accepted file, and remove it in success/failure finalization.
- [x] 2.4 Add upload invocation from canvas drop pipeline and map API responses to image insertion inputs.
- [x] 2.5 Route all successful dropped-image insertions through `OpsPersistenceManager.addImage` to preserve unified op persistence behavior.

## 3. Conditional Compression and Validation

- [x] 3.1 Implement client-side image threshold checks (size and max dimension) for drop files.
- [x] 3.2 Implement conditional compression path that runs only when thresholds are exceeded and outputs supported compressed image formats.
- [x] 3.3 Ensure non-image files are skipped without aborting the full drop batch and are surfaced as user-visible failures.
- [x] 3.4 Handle per-file compression/upload failures without blocking remaining files in the same drop operation.

## 4. User Feedback, Localization, and UX Hardening

- [x] 4.1 Add/adjust toast or inline feedback for skipped unsupported files, upload failures, and oversized/unprocessable files.
- [x] 4.2 Add i18n strings for new drag-drop upload/compression result messages in supported locales.
- [x] 4.3 Ensure placeholders never leak (no orphan loading masks) across all success/failure branches and aborted processing paths.

## 5. Verification and Regression Checks

- [x] 5.1 Verify single-image drop flow: placeholder appears, upload succeeds, image inserts, placeholder clears, and op persists after reload.
- [x] 5.2 Verify multi-image drop flow: multiple placeholders, mixed outcomes, successful files still insert and persist.
- [x] 5.3 Verify compression behavior: below-threshold files bypass compression; above-threshold files compress before upload.
- [x] 5.4 Verify fallback and compatibility: existing URL/text drag-drop behavior still works and non-drag import paths remain unaffected.
- [x] 5.5 Document manual QA evidence (scenarios + outcomes) in the change notes for implementation handoff.