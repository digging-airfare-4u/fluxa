## Purpose

Define homepage inspiration preview behavior on `/app`, including placement, data source, navigation, and graceful degradation states.

## Requirements

### Requirement: Homepage SHALL expose an inspiration preview section
The `/app` homepage SHALL render an inspiration preview section below the recent projects section so users can discover public works without leaving the homepage.

#### Scenario: Section placement on homepage
- **WHEN** an authenticated user opens `/app`
- **THEN** the page shows the recent projects section first
- **AND THEN** an inspiration preview section is visible below it

### Requirement: Homepage inspiration preview SHALL use latest public discover data
The inspiration section SHALL load publications from the existing discover gallery data source using latest ordering and a bounded preview size.

#### Scenario: Latest feed preview is loaded
- **WHEN** the inspiration section initializes on `/app`
- **THEN** the system fetches public discover publications sorted by latest
- **AND THEN** the section renders a bounded set of preview items (small fixed count)

### Requirement: Preview cards SHALL provide discover navigation paths
Each preview item SHALL navigate to its publication detail, and the section SHALL provide a "查看全部" action that navigates to the full discover page.

#### Scenario: Navigate from preview card to detail
- **WHEN** a user clicks a preview publication card
- **THEN** the user is navigated to `/app/discover/{publicationId}`

#### Scenario: Navigate to full discover page
- **WHEN** a user clicks the section-level "查看全部" action
- **THEN** the user is navigated to `/app/discover`

### Requirement: Inspiration section SHALL degrade gracefully on non-happy paths
The inspiration section SHALL handle loading, empty results, and fetch failures without blocking the rest of homepage functionality.

#### Scenario: Loading state before data resolves
- **WHEN** inspiration data is still being fetched
- **THEN** the section shows a loading placeholder/skeleton state
- **AND THEN** existing homepage functions remain usable

#### Scenario: Empty result state
- **WHEN** the latest discover query returns no publications
- **THEN** the section shows an empty-state message
- **AND THEN** the section-level discover entry point remains available

#### Scenario: Fetch failure state
- **WHEN** the latest discover query fails
- **THEN** the section shows a non-blocking fallback state
- **AND THEN** prompt entry, project creation, and recent projects on `/app` continue to work
