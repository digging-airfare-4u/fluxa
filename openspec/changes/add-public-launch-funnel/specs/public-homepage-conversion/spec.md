## ADDED Requirements

### Requirement: Public homepage SHALL communicate product value and primary entry points
The system SHALL present the public homepage as a conversion-oriented landing page that explains what Fluxa does, who it is for, and how a visitor can start using it.

#### Scenario: Visitor opens the public homepage
- **WHEN** an unauthenticated visitor navigates to `/`
- **THEN** the page shows a clear product value proposition, a primary call to action for starting creation, and at least one secondary entry point to browse public works

#### Scenario: Authenticated user opens the public homepage
- **WHEN** an authenticated user navigates to `/`
- **THEN** the primary call to action routes them into the authenticated app experience instead of opening a registration flow

### Requirement: Public homepage SHALL surface showcase content from the public community
The system SHALL display a bounded set of public works or showcase examples on the homepage so visitors can quickly understand the output quality and use cases.

#### Scenario: Showcase content is available
- **WHEN** the homepage loads and public showcase data exists
- **THEN** the page renders a bounded list or grid of public works with links to their public detail pages

#### Scenario: Showcase content is unavailable
- **WHEN** showcase data cannot be loaded or returns zero items
- **THEN** the homepage falls back to static product messaging and keeps primary calls to action usable

### Requirement: Public homepage SHALL support a short conversion path into registration or creation
The system SHALL provide a shortest-path flow from public homepage to signup/login and to authenticated creation, without requiring the visitor to browse the entire community first.

#### Scenario: Unauthenticated visitor clicks the primary CTA
- **WHEN** an unauthenticated visitor clicks the homepage primary CTA
- **THEN** the system opens or routes to authentication with intent preserved for post-login continuation

#### Scenario: Authenticated visitor clicks the primary CTA
- **WHEN** an authenticated user clicks the homepage primary CTA
- **THEN** the system routes the user to create a new project or open the authenticated home entry point immediately

