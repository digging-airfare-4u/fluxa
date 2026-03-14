## ADDED Requirements

### Requirement: Mode selector UI in ChatInput
The system SHALL display a mode selector above the ChatInput text area, presenting available chat modes as horizontal tabs with icon and label. The available modes are `classic`, `agent`, and `image-generator`.

#### Scenario: Default mode on first visit
- **WHEN** user opens the chat panel for the first time
- **THEN** the mode selector SHALL display `classic` as the selected mode

#### Scenario: Switch mode by clicking tab
- **WHEN** user clicks on the `image-generator` tab
- **THEN** the mode selector SHALL highlight `image-generator` and deselect the current mode
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

### Requirement: Mode-dependent toolbar visibility
The system SHALL show or hide toolbar controls in ChatInput based on the currently selected mode.

#### Scenario: Agent mode toolbar
- **WHEN** `agent` mode is selected
- **THEN** the `AspectRatioSelector` SHALL be visible
- **AND** the `ResolutionSelector` SHALL be visible
- **AND** the `@mention` button SHALL be visible
- **AND** the `ModelSelector` SHALL be hidden

#### Scenario: Image Generator mode toolbar
- **WHEN** `image-generator` mode is selected
- **THEN** the `AspectRatioSelector` SHALL be visible
- **AND** the `ResolutionSelector` SHALL be visible
- **AND** the `@mention` button SHALL be visible
- **AND** the `ModelSelector` SHALL be hidden

### Requirement: Mode determines generation route
The system SHALL route message submission to different backend endpoints based on the selected mode.

#### Scenario: Send message in classic mode
- **WHEN** user sends a message with `classic` mode selected
- **THEN** the system SHALL keep using the existing `generate-image` / `generate-ops` routing logic

#### Scenario: Send message in Agent mode
- **WHEN** user sends a message with `agent` mode selected
- **THEN** the system SHALL call the `agent` Edge Function
- **AND** SHALL NOT call `generate-image` or `generate-ops` for that request

#### Scenario: Send message in Image Generator mode
- **WHEN** user sends a message with `image-generator` mode selected
- **THEN** the system SHALL call the existing `generate-image` Edge Function with the configured Gemini image model
- **AND** SHALL NOT call the `agent` Edge Function for that request

### Requirement: Mode preference persistence
The system SHALL persist the user's selected chat mode across page navigations and browser sessions.

#### Scenario: Mode survives page refresh
- **WHEN** user selects `image-generator` mode and refreshes the page
- **THEN** the mode selector SHALL show `image-generator` as the selected mode after reload

#### Scenario: Mode persists across projects
- **WHEN** user selects `agent` mode in project A and navigates to project B
- **THEN** the mode selector in project B SHALL show `agent` as the selected mode

### Requirement: Mode state in Zustand store
The `useChatStore` SHALL include a `chatMode` state field of type `'classic' | 'agent' | 'image-generator'`, with corresponding `setChatMode` action.

#### Scenario: Store initialization with persisted preference
- **WHEN** the chat store initializes
- **THEN** `chatMode` SHALL be loaded from the persisted preference
- **AND** if no persisted preference exists, SHALL default to `'classic'`

#### Scenario: Set chat mode updates store
- **WHEN** `setChatMode('image-generator')` is called
- **THEN** the store's `chatMode` SHALL be `'image-generator'`
- **AND** the preference SHALL be persisted to localStorage
