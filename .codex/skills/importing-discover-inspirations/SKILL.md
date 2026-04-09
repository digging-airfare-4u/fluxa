---
name: importing-discover-inspirations
description: Use when a user provides an external prompt, gallery, template, or inspiration website URL and wants Fluxa's discover/灵感与发现 feed filled quickly - inspect the site, normalize entries into the import schema, write them into publications/publication_snapshots through the existing public flow, and verify the imported output.
---

# Importing Discover Inspirations

## Overview

Use this skill when the user gives a website URL and wants external inspiration content imported into Fluxa's current "灵感与发现" feed.

Keep the existing share flow unchanged. External inspiration should be written into the current `publications + publication_snapshots` model unless the user explicitly asks for a new table.

## Workflow

1. Inspect the site before scraping.
   - Open the landing page and one detail page.
   - Prefer structured sources in this order: embedded JSON, public API/network payloads, then DOM text.
   - If the site is JS-heavy, use Playwright snapshots and network inspection instead of blind `curl`.

2. Decide the import scope.
   - Confirm whether the user wants all items or a small trial batch first.
   - Decide the author account up front. Reuse the existing bot/import account if one already exists.

3. Normalize the source into JSON.
   - Save a JSON array under `tmp/discover-import/<site-key>.json`.
   - Shape each item with the schema in [normalized-entry-schema.md](./references/normalized-entry-schema.md).
   - Reuse aliases already supported by the importer when that saves effort.
   - If the user already downloaded images locally, prefer `result_local_path` and `reference_local_path` instead of uploading them manually first.

4. Dry-run before writing.
   - Run:
   - `pnpm import:discover:dry -- --input tmp/discover-import/<site-key>.json --site-key <site-key> --site-name "<Site Name>"`
   - Check `requested`, `prepared`, `skippedExisting`, `categories`, and the sample rows.
   - Fix schema or category problems before any write.

5. Import into Fluxa.
   - Run:
   - `pnpm import:discover -- --input tmp/discover-import/<site-key>.json --site-key <site-key> --site-name "<Site Name>" --user-id <uuid>`
   - Add `--prefer-local-images` if the JSON includes both remote URLs and local files but the local files should win.
   - The importer uploads local image paths to `public-assets`, then writes fake `project / document / conversation / messages / ops` rows plus real `publications / publication_snapshots` so the current UI can render them without frontend changes.

6. Verify the result.
   - Check the latest `get_gallery_publications` rows or query `publications` by the source tag.
   - Spot-check one text-only item and one reference-image item.
   - If the imported author should show a brand name, update that profile's `display_name`.

## Non-Negotiables

- Do not redesign the share flow for this task. This skill is for external inspiration imports, not user publishing.
- Default to storing external image URLs directly. Only mirror images into owned storage if the user explicitly wants the extra stability work.
- If the source material is already local files, upload them during import instead of asking the user to pre-upload them manually.
- Always dry-run first.
- Always tag imported rows with a stable source import key so reruns stay idempotent.
- If the source pages are inconsistent, stop and define a smaller normalized schema that still covers the required discover UI fields.

## Commands

- Generic dry-run:
  - `pnpm import:discover:dry -- --input tmp/discover-import/<site-key>.json --site-key <site-key> --site-name "<Site Name>"`
- Generic import:
  - `pnpm import:discover -- --input tmp/discover-import/<site-key>.json --site-key <site-key> --site-name "<Site Name>" --user-id <uuid>`
- Existing NanoBananas shortcut:
  - `pnpm import:nanobananas:dry`
  - `pnpm import:nanobananas`

## References

- Read [site-intake-playbook.md](./references/site-intake-playbook.md) when starting from a raw website URL.
- Read [normalized-entry-schema.md](./references/normalized-entry-schema.md) when shaping the JSON file.
- Read [fluxa-discover-model.md](./references/fluxa-discover-model.md) if you need to understand why the importer writes fake upstream rows before the public records.
