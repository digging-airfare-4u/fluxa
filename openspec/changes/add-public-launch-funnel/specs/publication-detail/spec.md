## MODIFIED Requirements

### Requirement: Publication detail page
The system SHALL render a public detail page at `/discover/[id]` displaying the full publication including cover image, metadata, conversation replay, and public interaction surfaces.

#### Scenario: Load published work detail publicly
- **WHEN** a visitor navigates to `/discover/{publicationId}` for a published work
- **THEN** the page displays: large cover image, title, description, category badge, author avatar + name, published date, view/like/bookmark/comment counts, and the conversation replay section without requiring login

#### Scenario: Load non-existent or hidden publication
- **WHEN** a visitor navigates to a publication ID that doesn't exist or has status `hidden`/`removed`
- **THEN** the page displays a 404 message with a link back to the public gallery

### Requirement: Author info section
The system SHALL display the publication author's public profile information on the public detail page and link to the public creator profile route.

#### Scenario: Render author card
- **WHEN** the public detail page loads
- **THEN** an author card is shown with: avatar, display name, bio (if set), publication count, follower count, and a "Follow" button (if the viewer is not the author)

#### Scenario: Click author name navigates to public profile
- **WHEN** a visitor clicks on the author's name or avatar
- **THEN** the user is navigated to `/u/{authorId}`

## ADDED Requirements

### Requirement: Public publication detail SHALL expose remix entry points
The system SHALL expose a Remix/Fork call to action on public publication detail pages so visitors can continue the showcased creative flow in their own project.

#### Scenario: Authenticated user sees remix call to action
- **WHEN** an authenticated user views a public publication detail page
- **THEN** the page displays a Remix/Fork action that starts the remix workflow for that publication

#### Scenario: Unauthenticated visitor sees remix call to action
- **WHEN** an unauthenticated visitor views a public publication detail page
- **THEN** the page displays a Remix/Fork action that routes through authentication before continuing

### Requirement: Public publication detail SHALL provide metadata for sharing and previews
The system SHALL generate shareable metadata for each public publication detail page using the publication's public fields.

#### Scenario: Social preview metadata for publication detail
- **WHEN** a public publication detail page is rendered for bots, crawlers, or social unfurlers
- **THEN** the response contains metadata derived from the publication title, description, canonical public URL, and public cover image

