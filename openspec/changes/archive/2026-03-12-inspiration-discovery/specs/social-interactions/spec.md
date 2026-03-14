## ADDED Requirements

### Requirement: Like a publication
The system SHALL allow authenticated users to like/unlike publications. Each user can like a publication at most once.

#### Scenario: Like a publication
- **WHEN** an authenticated user clicks the like button on a publication they haven't liked
- **THEN** a record is inserted into `publication_likes`, the publication's `like_count` increments by 1, and the UI updates optimistically (heart icon filled)

#### Scenario: Unlike a publication
- **WHEN** an authenticated user clicks the like button on a publication they have already liked
- **THEN** the record is deleted from `publication_likes`, the publication's `like_count` decrements by 1, and the UI updates optimistically (heart icon unfilled)

#### Scenario: Like state persists across sessions
- **WHEN** a user who previously liked a publication revisits the gallery or detail page
- **THEN** the like button shows the filled/active state for publications they have liked

#### Scenario: Unauthenticated user attempts to like
- **WHEN** an unauthenticated user clicks the like button
- **THEN** a login prompt is shown

### Requirement: Bookmark a publication
The system SHALL allow authenticated users to bookmark/unbookmark publications for later reference.

#### Scenario: Bookmark a publication
- **WHEN** an authenticated user clicks the bookmark button on a publication they haven't bookmarked
- **THEN** a record is inserted into `publication_bookmarks`, the publication's `bookmark_count` increments by 1, and the UI shows the bookmark as active

#### Scenario: Remove bookmark
- **WHEN** an authenticated user clicks the bookmark button on a bookmarked publication
- **THEN** the record is deleted, `bookmark_count` decrements by 1, and the UI shows the bookmark as inactive

#### Scenario: View bookmarked works
- **WHEN** a user navigates to their profile bookmarks section
- **THEN** all their bookmarked publications are displayed in a grid, sorted by bookmark date (newest first)

### Requirement: Comment on a publication
The system SHALL allow authenticated users to post comments on published works. Comments support one level of replies.

#### Scenario: Post a top-level comment
- **WHEN** an authenticated user submits a comment (1-500 characters) on a publication
- **THEN** the comment is inserted into `publication_comments` with `parent_id = NULL`, the publication's `comment_count` increments by 1, and the comment appears in the comment list

#### Scenario: Reply to a comment
- **WHEN** an authenticated user replies to an existing comment
- **THEN** the reply is inserted with `parent_id` set to the original comment's ID, grouped under the parent comment in the UI

#### Scenario: Comment nesting limit
- **WHEN** a user attempts to reply to a reply (depth > 1)
- **THEN** the reply is created with `parent_id` set to the root comment (flattened to one level), displayed as "@username: reply content"

#### Scenario: Delete own comment
- **WHEN** a user deletes their own comment
- **THEN** the comment is removed, `comment_count` decrements accordingly, and replies to that comment are also removed

#### Scenario: Publication owner deletes any comment
- **WHEN** the publication owner deletes a comment by another user on their publication
- **THEN** the comment is removed (owner moderation right)

#### Scenario: Empty comment rejected
- **WHEN** a user submits an empty comment or one exceeding 500 characters
- **THEN** the submission is rejected with a validation error

### Requirement: Comment list with pagination
The system SHALL display comments in reverse chronological order with load-more pagination.

#### Scenario: Initial comment load
- **WHEN** the detail page loads a publication with 50 comments
- **THEN** the 20 most recent top-level comments are displayed, each with their replies expanded inline

#### Scenario: Load more comments
- **WHEN** user clicks "加载更多" (Load More) at the bottom of comments
- **THEN** the next 20 top-level comments (with their replies) are appended

#### Scenario: Comment count display
- **WHEN** the comment section header renders
- **THEN** it shows the total comment count (top-level + replies)

### Requirement: Social interaction database tables
The system SHALL create `publication_likes`, `publication_bookmarks`, and `publication_comments` tables with appropriate RLS.

#### Scenario: Likes table structure
- **WHEN** the migration runs
- **THEN** `publication_likes` contains: publication_id (FK publications), user_id (FK auth.users) with composite primary key (publication_id, user_id), and created_at (timestamptz)

#### Scenario: Bookmarks table structure
- **WHEN** the migration runs
- **THEN** `publication_bookmarks` contains: publication_id (FK publications), user_id (FK auth.users) with composite primary key (publication_id, user_id), and created_at (timestamptz)

#### Scenario: Comments table structure
- **WHEN** the migration runs
- **THEN** `publication_comments` contains: id (UUID PK), publication_id (FK publications), user_id (FK auth.users), content (text NOT NULL, max 500), parent_id (UUID nullable self-reference), created_at (timestamptz), updated_at (timestamptz)

#### Scenario: RLS for social tables
- **WHEN** RLS is enabled
- **THEN** all social tables are publicly readable (SELECT), authenticated users can INSERT their own records (user_id = auth.uid()), and users can DELETE only their own records
