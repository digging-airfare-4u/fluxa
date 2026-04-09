# Fluxa Discover Model

Fluxa's current discover pages do not read from a standalone inspiration table.

They read from the existing public share model:

- `publications`
- `publication_snapshots`

And `publications` itself requires upstream foreign keys such as:

- `project_id`
- `document_id`
- `conversation_id`
- `user_id`

That is why the importer creates fake upstream rows before writing the public records:

- `projects`
- `documents`
- `conversations`
- `messages`
- `ops`

## Why this works

- discover cards read `publications.cover_image_url`, `title`, author profile fields, and counters
- discover detail pages read `publication_snapshots.messages_snapshot` and `ops_snapshot`
- reference-image inspirations need a replayable user message with `metadata.imageUrl`

## Image storage rule

For fast imports, store image URLs directly:

- `publications.cover_image_url` = result image URL
- `messages_snapshot[].metadata.imageUrl` = result or reference image URL
- `ops_snapshot[].payload.src` = result image URL

Do not mirror images into owned storage unless the user explicitly asks for that extra step.
