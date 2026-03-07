## ADDED Requirements

### Requirement: Publication detail page
The system SHALL render a detail page at `/app/discover/[id]` displaying the full publication including cover image, metadata, conversation replay, and social interactions.

#### Scenario: Load published work detail
- **WHEN** user navigates to `/app/discover/{publicationId}` for a published work
- **THEN** the page displays: large cover image, title, description, category badge, author avatar + name, published date, view/like/bookmark/comment counts, and the conversation replay section

#### Scenario: Load non-existent or hidden publication
- **WHEN** user navigates to a publication ID that doesn't exist or has status `hidden`/`removed`
- **THEN** the page displays a 404 message with a link back to the gallery

### Requirement: Conversation replay
The system SHALL render the conversation snapshot as a read-only message timeline, showing the full design creation process.

#### Scenario: Render message timeline
- **WHEN** the detail page loads a publication with a snapshot containing 10 messages
- **THEN** the page displays all 10 messages in chronological order, each showing: role (user/assistant), text content, and any inline images (from ops payload or message metadata)

#### Scenario: Display generated images inline
- **WHEN** a message in the snapshot contains or references a generated image (via ops like `addImage` or message metadata with image URLs)
- **THEN** the image is rendered inline within the message, showing the design output at each step

#### Scenario: Highlight user prompts
- **WHEN** the conversation replay renders user messages
- **THEN** user messages are visually distinct (e.g., right-aligned or with a "prompt" badge) so viewers can clearly see the prompts that drove the design

### Requirement: View count increment
The system SHALL increment the publication's view count when a user visits the detail page, with basic deduplication.

#### Scenario: First view by a user
- **WHEN** an authenticated user visits a publication detail page for the first time
- **THEN** the view count increments by 1

#### Scenario: Repeated view within 10 minutes
- **WHEN** the same user revisits the same publication within 10 minutes
- **THEN** the view count does NOT increment again

#### Scenario: Anonymous view
- **WHEN** an unauthenticated user visits a publication detail page
- **THEN** the view count increments by 1 (deduplication is best-effort based on session/IP)

### Requirement: Author info section
The system SHALL display the publication author's public profile information on the detail page.

#### Scenario: Render author card
- **WHEN** the detail page loads
- **THEN** an author card is shown with: avatar, display name, bio (if set), publication count, follower count, and a "Follow" button (if the viewer is not the author)

#### Scenario: Click author name navigates to profile
- **WHEN** user clicks on the author's name or avatar
- **THEN** the user is navigated to `/app/user/{authorId}`

### Requirement: Related works section
The system SHALL display a "related works" section below the conversation replay, showing other publications from the same author or same category.

#### Scenario: Related works from same author
- **WHEN** the author has other published works
- **THEN** up to 4 works from the same author are shown in a horizontal scroll row

#### Scenario: Author has no other works
- **WHEN** the author has only this one published work
- **THEN** the section shows up to 4 works from the same category instead
