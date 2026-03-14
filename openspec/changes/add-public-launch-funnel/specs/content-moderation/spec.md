## ADDED Requirements

### Requirement: Public community content SHALL support user reports
The system SHALL allow users to report public works, public comments, and public creator-profile content for moderation review.

#### Scenario: Report a publication
- **WHEN** an authenticated user submits a report on a public publication
- **THEN** the system records a moderation report containing the target type, target id, reporter identity, reason, and created timestamp

#### Scenario: Report a comment
- **WHEN** an authenticated user submits a report on a public comment
- **THEN** the system records the report without removing the comment immediately

#### Scenario: Report a creator profile
- **WHEN** an authenticated user reports a creator profile or public profile content
- **THEN** the system records the report for operator review

### Requirement: Public interaction surfaces SHALL enforce anti-abuse rate limits
The system SHALL apply baseline anti-abuse constraints to public community reporting and commenting flows so a single actor cannot spam core moderation surfaces.

#### Scenario: Excessive repeated reports
- **WHEN** a user submits reports above the configured rate threshold within the enforcement window
- **THEN** the system rejects additional reports with a rate-limit response

#### Scenario: Excessive repeated comments
- **WHEN** a user submits comments above the configured rate threshold within the enforcement window
- **THEN** the system rejects additional comments with a rate-limit response

### Requirement: Operators SHALL be able to hide or remove flagged public content
The system SHALL support an operator or controlled backend workflow that can hide or remove reported public publications and comments without deleting underlying audit records.

#### Scenario: Operator hides a publication
- **WHEN** an operator marks a reported publication as hidden or removed
- **THEN** the publication stops appearing on public discovery surfaces while report history remains queryable for audit

#### Scenario: Operator removes a comment
- **WHEN** an operator marks a reported comment as removed
- **THEN** the comment stops appearing on public pages while the related moderation report remains retained

