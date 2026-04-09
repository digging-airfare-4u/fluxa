# Normalized Entry Schema

The generic importer reads a JSON array. Each item can use either the generic field names below or the already-supported aliases.

## Required fields

- `site_key`
  - Alias: `siteKey`
  - If omitted, the importer can derive it from `source_url` or accept `--site-key`
- `entry_type`
  - Aliases: `entryType`, `source`, `type`
- `external_id`
  - Aliases: `externalId`, `id`, `slug`
- `result_image_url` or `result_local_path`
  - Aliases: `resultImageUrl`, `cover_image_url`, `coverImageUrl`, `image_url`, `imageUrl`
  - Local aliases: `resultLocalPath`, `cover_local_path`, `coverLocalPath`, `image_local_path`, `imageLocalPath`
- `source_url`
  - Aliases: `sourceUrl`, `url`
  - Optional for custom local datasets with no public source page
- `slug`
  - Optional only if `title` exists; otherwise provide it explicitly

## Optional fields

- `site_name`
- `title`
- `title_zh`
- `title_en`
- `prompt`
- `prompt_zh`
- `prompt_en`
- `reference_image_url`
- `result_local_path`
- `reference_local_path`
- `note`
- `requires_reference_image`
- `category_hint`
- `tags`
- `published_at`

## Import behavior

- `title` falls back to `title_zh`, then `title_en`
- `prompt` falls back to `prompt_zh`, then `prompt_en`, then `title`
- `requires_reference_image` defaults to `true` when `reference_image_url` exists
- If `result_local_path` or `reference_local_path` is provided, the importer uploads the file to `public-assets` during import and writes the resulting public URL into `publications` and snapshots
- `importKey` is generated as `<site_key>:<entry_type>:<external_id>`
- `tags` automatically include:
  - `<site_key>`
  - `<entry_type>`
  - `<slug>`
  - `<importKey>`
  - `reference-image` when applicable

## Example

```json
[
  {
    "site_key": "custom-pack",
    "site_name": "Custom Pack",
    "entry_type": "template",
    "external_id": "poster-001",
    "title": "本地活动海报",
    "prompt_zh": "制作一张极简活动海报，突出日期、地点和主视觉。",
    "result_local_path": "./images/output/poster-001.webp",
    "reference_local_path": "./images/input/poster-001-reference.png",
    "note": "使用本地参考图和最终出图。",
    "slug": "local-event-poster",
    "category_hint": "poster-design",
    "tags": ["offline", "custom"]
  }
]
```

## Commands

```bash
pnpm import:discover:dry -- --input tmp/discover-import/nanobananas.json --site-key nanobananas --site-name "NanoBananas"
pnpm import:discover -- --input tmp/discover-import/nanobananas.json --site-key nanobananas --site-name "NanoBananas" --user-id <uuid>
pnpm import:discover -- --input tmp/discover-import/custom-pack.json --site-key custom-pack --site-name "Custom Pack" --user-id <uuid> --prefer-local-images
```
