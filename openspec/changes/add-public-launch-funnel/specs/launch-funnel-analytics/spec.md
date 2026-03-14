## ADDED Requirements

### Requirement: System SHALL emit a unified launch-funnel event model
The system SHALL define and emit a consistent event model for public acquisition, signup, activation, publication, and checkout milestones.

#### Scenario: Public visitor enters the funnel
- **WHEN** a visitor lands on the public homepage or a public publication page
- **THEN** the system emits normalized public-entry events using a shared analytics abstraction instead of page-specific ad hoc logs

#### Scenario: User advances to a new funnel stage
- **WHEN** a user completes a tracked milestone such as signup, first project creation, first generation, first publication, checkout start, or checkout success
- **THEN** the system emits the corresponding normalized funnel event exactly once per completed action occurrence

### Requirement: Analytics capture SHALL support production-grade sinks
The system SHALL route launch-funnel events through a sink abstraction that supports local development fallback and production delivery to an external analytics destination.

#### Scenario: Development environment capture
- **WHEN** the analytics sink is running in a local or development environment
- **THEN** the system MAY use a debug-friendly fallback sink while preserving the same event names and payload contract

#### Scenario: Production environment capture
- **WHEN** the analytics sink is running in a production environment
- **THEN** the system sends launch-funnel events to a configured production analytics destination instead of relying only on console output

### Requirement: Analytics failures SHALL NOT break user flows
The system SHALL treat analytics delivery as non-blocking so failed event emission cannot break browsing, remixing, signup, or checkout.

#### Scenario: Analytics sink fails
- **WHEN** the analytics layer fails to deliver an event
- **THEN** the user-facing action still completes and the failure is handled without surfacing a blocking application error

