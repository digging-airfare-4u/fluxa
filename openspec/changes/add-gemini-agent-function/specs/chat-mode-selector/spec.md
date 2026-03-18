## ADDED Requirements

### Requirement: Mode selector UI in ChatInput
The system SHALL display a mode selector above the ChatInput text area, presenting available chat modes as horizontal tabs with icon and label. The available modes are `classic` and `agent`.

#### Scenario: Default mode on first visit
- **WHEN** user opens the chat panel for the first time
- **THEN** the mode selector SHALL display `classic` as the selected mode

#### Scenario: Switch mode by clicking tab
- **WHEN** user clicks on the `agent` tab
- **THEN** the mode selector SHALL highlight `agent` and deselect the current mode
- **AND** the toolbar controls below SHALL update to match the selected mode

### Requirement: Classic mode preserves current behavior
When `classic` mode is selected, the chat input and send flow SHALL preserve the current model-driven behavior.

#### Scenario: Classic mode keeps current controls
- **WHEN** `classic` mode is selected
- **THEN** the system SHALL keep using the existing `ModelSelector`
- **AND** SHALL preserve the current `generate-image` / `generate-ops` route selection based on the selected model

#### Scenario: Switching away from classic does not discard selected model
- **WHEN** user selects a model in `classic` mode, switches to another mode, and later switches back
- **THEN** the previously selected classic model SHALL still be selected

#### Scenario: Agent-only billing model is not shown in classic selector
- **WHEN** the system loads enabled models for the classic `ModelSelector`
- **AND** `ai_models` contains a dedicated Agent model entry for pricing and display
- **THEN** that Agent-only model SHALL NOT be rendered as a classic selectable model

### Requirement: Mode-dependent toolbar visibility
The system SHALL show or hide toolbar controls in ChatInput based on the currently selected mode.

#### Scenario: Agent mode toolbar
- **WHEN** `agent` mode is selected
- **THEN** the `AspectRatioSelector` SHALL be visible
- **AND** the `ResolutionSelector` SHALL be visible
- **AND** the `@mention` button SHALL be visible
- **AND** the `ModelSelector` SHALL remain visible but SHALL only list text / ops capable models
- **AND** Agent mode SHALL use its own selected brain model without overwriting the classic mode selection

### Requirement: Mode determines generation route
The system SHALL route message submission to different backend endpoints based on the selected mode.

#### Scenario: Send message in classic mode
- **WHEN** user sends a message with `classic` mode selected
- **THEN** the system SHALL keep using the existing `generate-image` / `generate-ops` routing logic

#### Scenario: Send message in Agent mode
- **WHEN** user sends a message with `agent` mode selected
- **THEN** the system SHALL call the `agent` Edge Function
- **AND** SHALL NOT call `generate-image` or `generate-ops` for that request

### Requirement: Mode preference persistence
The system SHALL persist the user's selected chat mode across page navigations and browser sessions.

#### Scenario: Mode survives page refresh
- **WHEN** user selects `agent` mode and refreshes the page
- **THEN** the mode selector SHALL show `agent` as the selected mode after reload

#### Scenario: Mode persists across projects
- **WHEN** user selects `agent` mode in project A and navigates to project B
- **THEN** the mode selector in project B SHALL show `agent` as the selected mode

### Requirement: Mode state in Zustand store
The `useChatStore` SHALL include a `chatMode` state field of type `'classic' | 'agent'`, with corresponding `setChatMode` action, and SHALL track Agent brain selection independently from the classic model selection.

#### Scenario: Store initialization with persisted preference
- **WHEN** the chat store initializes
- **THEN** `chatMode` SHALL be loaded from the persisted preference
- **AND** if no persisted preference exists, SHALL default to `'classic'`

#### Scenario: Set chat mode updates store
- **WHEN** `setChatMode('agent')` is called
- **THEN** the store's `chatMode` SHALL be `'agent'`
- **AND** the preference SHALL be persisted to localStorage
