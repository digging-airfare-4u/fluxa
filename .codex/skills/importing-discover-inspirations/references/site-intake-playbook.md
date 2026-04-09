# Site Intake Playbook

Use this checklist when the user gives only a website URL.

## 1. Find the real data source

- Open the landing page and one detail page.
- Look for embedded JSON, `__NEXT_DATA__`, `application/ld+json`, inlined script state, or XHR/fetch responses.
- If the list page is paginated or lazy-loaded, inspect network requests before scraping the DOM.
- Prefer extracting JSON payloads over parsing rendered text.

## 2. Define the minimum import unit

Each imported item needs enough data for:

- discover card cover
- discover card title
- discover detail replay
- reference image replay when applicable
- stable dedupe key on rerun

If the site has more metadata than Fluxa needs, ignore it unless the user asks to preserve it.

## 3. Map fields before collecting

Map the site into:

- `site_key`
- `site_name`
- `entry_type`
- `external_id`
- `title`
- `prompt` or `prompt_zh` / `prompt_en`
- `result_image_url`
- `reference_image_url`
- `note`
- `source_url`
- `slug`
- optional `category_hint`
- optional `tags`

If the site has no obvious stable ID, build one from a stable slug or URL path segment.

## 4. Save a normalized file

Write the normalized JSON array to:

`tmp/discover-import/<site-key>.json`

Keep the file flat and explicit. Avoid nested site-specific blobs unless they are needed to derive required fields later.

## 5. Dry-run, then import

- Dry-run first with `pnpm import:discover:dry`
- Inspect the summary output
- Only then run `pnpm import:discover`

## 6. Post-import checks

- Verify row counts
- Verify latest gallery cards
- Verify at least one detail page with reference image data if the source supports img2img-style examples
