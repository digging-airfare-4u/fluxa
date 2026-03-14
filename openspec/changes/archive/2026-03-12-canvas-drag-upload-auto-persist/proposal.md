## Why

Dragging local files into the canvas currently does not upload the files or reliably persist them as project assets, so users cannot complete a seamless drop-to-canvas workflow. We need to fix this now to support a core editor interaction: dropping files should immediately create canvas content backed by durable storage.

## What Changes

- Add a complete drag-and-drop file ingestion flow for canvas that supports both single-image and multi-image drops.
- When a user drops image files, immediately show per-image loading placeholders on canvas at drop-derived positions.
- Upload dropped images to system storage (COS) and create corresponding `assets` records with `type = upload` and source metadata.
- Apply conditional client-side compression before upload (only when files exceed configured size/dimension thresholds).
- Insert uploaded images onto canvas via the existing unified persistence path (`OpsPersistenceManager.addImage`) so ops are saved consistently.
- Remove loading placeholders when each image either succeeds or fails, and show user feedback for skipped/failed files.

## Capabilities

### New Capabilities
- `canvas-drag-upload`: Dragging local image files onto canvas uploads them to persistent storage, records assets metadata, and places resulting images on canvas with loading-state feedback.

### Modified Capabilities
- None.

## Impact

- Affected frontend: canvas drag/drop handling in `CanvasStage`, placeholder lifecycle integration, and user feedback for per-file outcomes.
- Affected backend/API: new upload endpoint/function for authenticated COS upload + `assets` insertion.
- Affected data model usage: `assets` rows for user-uploaded files, including metadata source fields and quota-related checks where applicable.
- Affected editor behavior: dropped files become persisted canvas images through existing ops persistence rather than temporary-only local state.