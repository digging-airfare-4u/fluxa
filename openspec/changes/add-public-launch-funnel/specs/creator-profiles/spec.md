## MODIFIED Requirements

### Requirement: Public creator profile page
The system SHALL render a public profile page at `/u/[userId]` displaying the creator's information and published works.

#### Scenario: View creator profile
- **WHEN** a visitor navigates to `/u/{userId}`
- **THEN** the page displays: avatar, display name, bio, follower count, following count, publication count, and a grid of published works sorted by `published_at` descending without requiring login

#### Scenario: Creator with no publications
- **WHEN** a visitor navigates to a creator profile who has no published works
- **THEN** the profile info is shown with an empty state message in the works section

#### Scenario: Non-existent user
- **WHEN** a visitor navigates to `/u/{invalidId}`
- **THEN** a 404 page is displayed

### Requirement: Follow a creator
The system SHALL allow authenticated users to follow/unfollow other creators from public creator profiles or other public community surfaces.

#### Scenario: Follow a creator
- **WHEN** an authenticated user clicks "关注" (Follow) on another user's public profile or publication card
- **THEN** a record is inserted into `user_follows`, the followed user's `follower_count` increments by 1, the follower's `following_count` increments by 1, and the button changes to "已关注" (Following)

#### Scenario: Unfollow a creator
- **WHEN** an authenticated user clicks "已关注" on a followed creator on a public surface
- **THEN** the record is deleted from `user_follows`, both counts decrement by 1, and the button reverts to "关注"

#### Scenario: Cannot follow self
- **WHEN** a user views their own public profile
- **THEN** no Follow button is displayed

#### Scenario: Unauthenticated user attempts to follow
- **WHEN** an unauthenticated visitor clicks the Follow button on a public creator surface
- **THEN** a login prompt is shown

## ADDED Requirements

### Requirement: Public creator profile pages SHALL be shareable and indexable
The system SHALL provide public creator profile pages that can be opened externally and enriched with search/share metadata.

#### Scenario: Public creator profile link is shared
- **WHEN** a public creator profile URL is opened by an external visitor
- **THEN** the profile page renders publicly visible profile fields and published works without redirecting to login

#### Scenario: Creator profile metadata is generated
- **WHEN** a public creator profile page is rendered
- **THEN** the system returns metadata derived from the creator's public profile and canonical public URL

