## ADDED Requirements

### Requirement: Public creator profile page
The system SHALL render a public profile page at `/app/user/[userId]` displaying the creator's information and published works.

#### Scenario: View creator profile
- **WHEN** a user navigates to `/app/user/{userId}`
- **THEN** the page displays: avatar, display name, bio, follower count, following count, publication count, and a grid of their published works sorted by `published_at` descending

#### Scenario: Creator with no publications
- **WHEN** a user navigates to a creator profile who has no published works
- **THEN** the profile info is shown with an empty state message in the works section

#### Scenario: Non-existent user
- **WHEN** a user navigates to `/app/user/{invalidId}`
- **THEN** a 404 page is displayed

### Requirement: Edit own profile
The system SHALL allow authenticated users to edit their public profile information (display_name, avatar_url, bio).

#### Scenario: Update display name
- **WHEN** user edits their display name to a new value (1-30 characters)
- **THEN** the `user_profiles.display_name` is updated and immediately reflected on their profile page and all publication cards

#### Scenario: Upload avatar
- **WHEN** user uploads a new avatar image (PNG/JPEG/WebP, max 2MB)
- **THEN** the image is stored in `public-assets/avatars/{userId}.{ext}`, the `avatar_url` is updated, and the new avatar appears everywhere

#### Scenario: Update bio
- **WHEN** user edits their bio (0-200 characters)
- **THEN** the `user_profiles.bio` is updated

#### Scenario: Display name too long
- **WHEN** user submits a display name exceeding 30 characters
- **THEN** the update is rejected with a validation error

### Requirement: Follow a creator
The system SHALL allow authenticated users to follow/unfollow other creators.

#### Scenario: Follow a creator
- **WHEN** an authenticated user clicks "关注" (Follow) on another user's profile or publication card
- **THEN** a record is inserted into `user_follows`, the followed user's `follower_count` increments by 1, the follower's `following_count` increments by 1, and the button changes to "已关注" (Following)

#### Scenario: Unfollow a creator
- **WHEN** an authenticated user clicks "已关注" on a followed creator
- **THEN** the record is deleted from `user_follows`, both counts decrement by 1, and the button reverts to "关注"

#### Scenario: Cannot follow self
- **WHEN** a user views their own profile
- **THEN** no Follow button is displayed

#### Scenario: Unauthenticated user attempts to follow
- **WHEN** an unauthenticated user clicks the Follow button
- **THEN** a login prompt is shown

### Requirement: Extend user_profiles with public fields
The system SHALL add public profile fields to the existing `user_profiles` table.

#### Scenario: New columns added
- **WHEN** the migration runs
- **THEN** `user_profiles` gains: display_name (text, default NULL), avatar_url (text, default NULL), bio (text, default NULL, max 200), follower_count (int, default 0), following_count (int, default 0), publication_count (int, default 0)

#### Scenario: Public read for profile fields
- **WHEN** any user (authenticated or not) queries another user's display_name, avatar_url, bio, and counts
- **THEN** the query succeeds (a new RLS policy allows public SELECT on specific columns via a database view `public_profiles`)

#### Scenario: Private fields remain protected
- **WHEN** a user queries another user's points or membership_level via `user_profiles`
- **THEN** the query returns no results (existing RLS `id = auth.uid()` still applies to the base table)

### Requirement: User follows database table
The system SHALL create a `user_follows` table with triggers to maintain follower/following counts.

#### Scenario: Table structure
- **WHEN** the migration runs
- **THEN** `user_follows` contains: follower_id (FK auth.users), following_id (FK auth.users) with composite primary key (follower_id, following_id), created_at (timestamptz), and a CHECK constraint preventing self-follow (follower_id != following_id)

#### Scenario: Count triggers
- **WHEN** a follow record is inserted
- **THEN** a trigger increments `follower_count` on the followed user's profile and `following_count` on the follower's profile

#### Scenario: Unfollow count triggers
- **WHEN** a follow record is deleted
- **THEN** a trigger decrements both counts, never going below 0

#### Scenario: RLS for follows
- **WHEN** RLS is enabled
- **THEN** `user_follows` is publicly readable (SELECT), authenticated users can INSERT/DELETE only their own follows (follower_id = auth.uid())

### Requirement: My publications management
The system SHALL provide a section in the user's profile to manage their own published works.

#### Scenario: View my publications
- **WHEN** user navigates to their profile publications section
- **THEN** all their publications are listed (both published and hidden), sorted by `created_at` descending, each showing: cover thumbnail, title, status badge, view/like/comment counts, and action buttons (edit/hide/delete)

#### Scenario: My bookmarks section
- **WHEN** user navigates to their profile bookmarks section
- **THEN** all bookmarked publications are displayed in a grid, with option to remove bookmark
