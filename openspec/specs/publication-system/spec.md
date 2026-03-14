## Purpose

TBD

## Requirements

### Requirement: Publish conversation as public work
The system SHALL allow authenticated users to publish a conversation (with its associated design output) as a public work visible in the community gallery.

#### Scenario: Successful publication
- **WHEN** user submits the publish form with a valid title, cover image, and category
- **THEN** the system creates a publication record with status `published`, generates a conversation snapshot, copies the cover image to the public bucket, and returns the publication ID

#### Scenario: Missing required fields
- **WHEN** user attempts to publish without a title or cover image
- **THEN** the system rejects the request and displays validation errors for missing fields

#### Scenario: User not authenticated
- **WHEN** an unauthenticated user attempts to publish
- **THEN** the system rejects the request with a 401 error

### Requirement: Conversation snapshot on publish
The system SHALL create an immutable snapshot of the conversation at publish time, including all messages, ops, and final canvas state, stored as JSONB in `publication_snapshots`.

#### Scenario: Snapshot captures full conversation
- **WHEN** a conversation with 15 messages and 30 ops is published
- **THEN** the snapshot contains all 15 messages (role, content, metadata) and all 30 ops (op_type, payload) in chronological order, plus the document's current canvas_state, width, and height

#### Scenario: Original conversation modified after publish
- **WHEN** the user adds new messages to the original conversation after publishing
- **THEN** the published snapshot remains unchanged — the new messages do not appear in the published work

### Requirement: Cover image storage
The system SHALL store publication cover images in a `public-assets` bucket with public read access, using the path format `covers/{publicationId}.{ext}`.

#### Scenario: Cover from conversation images
- **WHEN** user selects a generated image from the conversation as cover
- **THEN** the system copies the image to `public-assets/covers/{publicationId}.{ext}` and stores the public URL in the publication record

#### Scenario: Cover from local upload
- **WHEN** user uploads a local image as cover
- **THEN** the system validates the image (PNG/JPEG/WebP, max 5MB), stores it in the public bucket, and records the URL

### Requirement: Publication categories
The system SHALL maintain a `publication_categories` table with pre-seeded categories. Each publication MUST belong to exactly one category.

#### Scenario: List available categories
- **WHEN** the publish form is opened
- **THEN** the system displays all active categories sorted by `sort_order`, each showing name and icon

#### Scenario: Pre-seeded categories
- **WHEN** the system is initialized
- **THEN** the following categories exist: 海报设计, 社交媒体, 电商营销, 品牌物料, 节日贺卡, 邀请函, 插画创意, 其他

### Requirement: Publication management by owner
The system SHALL allow the publication owner to update metadata (title, description, category) and change publication status (published/hidden).

#### Scenario: Owner updates title
- **WHEN** the publication owner changes the title to a new value (1-50 characters)
- **THEN** the system updates the title and `updated_at` timestamp

#### Scenario: Owner hides publication
- **WHEN** the publication owner sets status to `hidden`
- **THEN** the publication no longer appears in the gallery but retains all data (likes, comments, bookmarks)

#### Scenario: Owner re-publishes hidden work
- **WHEN** the publication owner sets a hidden publication's status back to `published`
- **THEN** the publication reappears in the gallery with all original social data intact

#### Scenario: Non-owner attempts to modify
- **WHEN** a user who is not the publication owner attempts to update or hide it
- **THEN** the system rejects the request (RLS denies the operation)

### Requirement: Re-publish with updated snapshot
The system SHALL allow the publication owner to re-publish, generating a new snapshot from the current conversation state while preserving the publication ID and all social data.

#### Scenario: Owner re-publishes
- **WHEN** the owner triggers re-publish on an existing publication
- **THEN** the system creates a new snapshot (overwriting the old one), optionally updates the cover image, and keeps the existing likes, comments, bookmarks, and view count

### Requirement: Publication database schema
The system SHALL create a `publications` table and a `publication_snapshots` table with the following structure.

#### Scenario: Publications table structure
- **WHEN** the migration runs
- **THEN** the `publications` table contains columns: id (UUID PK), user_id (FK auth.users), project_id (FK projects), document_id (FK documents), conversation_id (FK conversations), title (varchar 50 NOT NULL), description (text nullable), cover_image_url (text NOT NULL), category_id (FK publication_categories), tags (text[] default '{}'), status (text CHECK IN published/hidden/removed, default published), view_count (int default 0), like_count (int default 0), comment_count (int default 0), bookmark_count (int default 0), published_at (timestamptz), created_at (timestamptz), updated_at (timestamptz)

#### Scenario: Publication snapshots table structure
- **WHEN** the migration runs
- **THEN** the `publication_snapshots` table contains columns: id (UUID PK), publication_id (FK publications UNIQUE), messages_snapshot (jsonb NOT NULL), ops_snapshot (jsonb NOT NULL), canvas_state_snapshot (jsonb), canvas_width (int), canvas_height (int), created_at (timestamptz)

### Requirement: Publication RLS policies
The system SHALL enforce row-level security: published works are publicly readable, only owners can INSERT/UPDATE/DELETE their own publications.

#### Scenario: Unauthenticated user reads published work
- **WHEN** an unauthenticated or any authenticated user queries publications with status `published`
- **THEN** the query succeeds and returns matching publications

#### Scenario: User reads hidden work of another user
- **WHEN** a user queries a publication with status `hidden` owned by another user
- **THEN** the query returns no results (RLS filters it out)

#### Scenario: Owner manages own publication
- **WHEN** the publication owner performs INSERT, UPDATE, or DELETE
- **THEN** the operation succeeds if the user_id matches auth.uid()
