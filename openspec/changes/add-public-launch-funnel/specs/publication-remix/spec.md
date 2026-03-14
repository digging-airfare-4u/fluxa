## ADDED Requirements

### Requirement: Users SHALL be able to start a remix flow from a public publication
The system SHALL expose a Remix/Fork entry point on public publication detail pages so users can create their own editable project from a published work.

#### Scenario: Authenticated user clicks remix
- **WHEN** an authenticated user clicks the Remix action on a public publication detail page
- **THEN** the system starts a remix workflow for that publication and routes the user into a new editable project

#### Scenario: Unauthenticated visitor clicks remix
- **WHEN** an unauthenticated visitor clicks the Remix action on a public publication detail page
- **THEN** the system requires authentication and preserves enough intent to resume the remix flow after login

### Requirement: Remix SHALL create a new private project from publication snapshot data
The system SHALL create a new project boundary for the remixed work using the publication snapshot, rather than editing the original publication or source conversation.

#### Scenario: Remix succeeds
- **WHEN** remix initialization succeeds for a valid public publication
- **THEN** the system creates a new project, document, and editable conversation context for the requesting user using the publication snapshot data

#### Scenario: Original publication remains unchanged
- **WHEN** a remixed project is later edited by the remixer
- **THEN** the original publication, its snapshot, and its social data remain unchanged

### Requirement: Remix SHALL preserve enough creative context to continue creation
The system SHALL carry over the published design context needed for continued editing, including the publication snapshot's message flow and canvas state or their editable equivalents.

#### Scenario: Remixed project opens in editor
- **WHEN** the system routes the user into the new remixed project
- **THEN** the editor loads with the publication-derived creative context available for continued iteration instead of an empty canvas

#### Scenario: Invalid or unavailable publication cannot be remixed
- **WHEN** remix is requested for a hidden, removed, or non-existent publication
- **THEN** the system rejects the remix request with an actionable error and does not create a project

