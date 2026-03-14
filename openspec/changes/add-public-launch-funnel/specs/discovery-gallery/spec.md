## MODIFIED Requirements

### Requirement: Gallery page with masonry layout
The system SHALL display published works in a responsive masonry (waterfall) grid layout at the public route `/discover`, while authenticated app navigation MAY continue to expose an in-app entry to the same discovery experience.

#### Scenario: Public gallery renders with publications
- **WHEN** a visitor navigates to `/discover` and there are 20 published works
- **THEN** the page renders a masonry grid showing publication cards with cover images, titles, author avatars, author names, view counts, and like counts without requiring login

#### Scenario: Responsive column count
- **WHEN** the viewport width changes on the public gallery page
- **THEN** the grid adjusts: 2 columns on mobile (< 768px), 3 columns on tablet (768-1024px), 4 columns on desktop (1024-1440px), 5 columns on wide screens (> 1440px)

#### Scenario: Empty state
- **WHEN** no published works exist (or none match the current filter) on `/discover`
- **THEN** the page displays an empty state illustration with a message encouraging the visitor to create and share their first design

### Requirement: Gallery navigation entry
The system SHALL expose discovery from both the public web surface and the authenticated app surface.

#### Scenario: Public entry to gallery
- **WHEN** a visitor browses the public homepage or any public publication page
- **THEN** the UI provides a navigable entry point to `/discover`

#### Scenario: Authenticated sidebar shows discover icon
- **WHEN** any authenticated `/app/*` page is rendered
- **THEN** the left sidebar displays a Compass icon for "灵感发现" between the Home and Projects icons

#### Scenario: Active state
- **WHEN** an authenticated user is on the discovery entry used inside the app
- **THEN** the Compass icon is highlighted as active

## ADDED Requirements

### Requirement: Public discovery pages SHALL be shareable and indexable
The system SHALL provide public discovery browsing that can be linked externally and enriched with search/share metadata.

#### Scenario: Discovery page is shared externally
- **WHEN** a public `/discover` URL is copied or shared
- **THEN** an external visitor can open the page and browse published works without being redirected to login

#### Scenario: Discovery page metadata is generated
- **WHEN** the public discovery page is rendered
- **THEN** the system returns discovery-specific metadata suitable for search and social previews

