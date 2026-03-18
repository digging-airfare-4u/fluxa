## ADDED Requirements

### Requirement: Agent process panel in chat messages
When an `agent` request is in progress or has completed, the chat panel SHALL provide a process visualization area for that assistant turn. The visualization SHALL be driven by structured Agent events rather than raw chain-of-thought text.

#### Scenario: In-progress Agent turn shows process panel
- **WHEN** an Agent turn is actively streaming
- **THEN** the assistant message area SHALL show a process panel or timeline
- **AND** the panel SHALL update as new structured Agent events arrive

#### Scenario: Completed Agent turn keeps process summary
- **WHEN** an Agent turn completes successfully
- **THEN** the chat panel SHALL preserve a compact process summary for that message
- **AND** the user SHALL be able to expand it to inspect steps, tools, and citations

### Requirement: Process visualization uses structured stages and steps
The visualization layer SHALL render the Agent's structured stages, plans, and step status transitions.

#### Scenario: Phase is rendered
- **WHEN** the frontend receives a `phase` event
- **THEN** the process panel SHALL display the current stage label

#### Scenario: Plan and step status are rendered
- **WHEN** the frontend receives `plan`, `step_start`, or `step_done` events
- **THEN** the process panel SHALL render the current step list and status transitions
- **AND** SHALL mark completed steps distinctly from pending or in-progress steps

### Requirement: Search and tool activity are visible
The visualization SHALL make search decisions, tool execution, and search/image activity visible in the chat panel.

#### Scenario: Search decision is shown
- **WHEN** the frontend receives a `decision` event indicating whether search is needed
- **THEN** the process panel SHALL render that decision in a user-readable form

#### Scenario: Tool activity is shown
- **WHEN** the frontend receives `tool_start` or `tool_result` events
- **THEN** the process panel SHALL show the current tool name and status

#### Scenario: Image result is shown
- **WHEN** the Agent generates or ingests an image during the turn
- **THEN** the process panel or message card SHALL render the resulting image reference in a user-visible way

### Requirement: Citations are rendered in the message UI
If the Agent uses verified search results, the chat panel SHALL display citations alongside the final answer.

#### Scenario: Citations shown after search-backed answer
- **WHEN** the final Agent message metadata includes citations
- **THEN** the message UI SHALL display those citations with title and link

#### Scenario: No citations when no verified search used
- **WHEN** the Agent completes a turn without verified external sources
- **THEN** the citation area MAY be omitted

### Requirement: Raw chain-of-thought is not rendered
The chat panel SHALL NOT render raw internal reasoning text as a first-class UI artifact.

#### Scenario: Structured summary only
- **WHEN** the Agent emits process visualization events
- **THEN** the frontend SHALL render only the structured summaries, labels, and statuses defined by the protocol
- **AND** SHALL NOT expose hidden raw reasoning content directly to end users
