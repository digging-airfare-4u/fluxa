## ADDED Requirements

### Requirement: Agent Edge Function endpoint
The system SHALL expose a Supabase Edge Function at `functions/v1/agent` that accepts POST requests with JSON body containing `projectId`, `documentId`, `conversationId`, and `prompt`, plus optional `aspectRatio`, `resolution`, and `referenceImageUrl`.

#### Scenario: Valid Agent request
- **WHEN** a POST request is sent with valid authentication and the required fields
- **THEN** the function SHALL return a `200` response with `Content-Type: text/event-stream`
- **AND** SHALL begin streaming Agent events

#### Scenario: Missing required fields
- **WHEN** a POST request is sent without `projectId`, `documentId`, `conversationId`, or `prompt`
- **THEN** the function SHALL return `400` with a structured validation error body

### Requirement: Authentication, authorization, and ownership validation
The Agent Edge Function SHALL verify the user's identity from the `Authorization` header and SHALL verify access to the referenced project and conversation before processing.

#### Scenario: Valid user and conversation access
- **WHEN** a request includes a valid JWT and the conversation belongs to the specified project
- **THEN** the function SHALL proceed with processing

#### Scenario: Invalid conversation ownership
- **WHEN** a request references a conversation outside the current user's accessible project scope
- **THEN** the function SHALL reject the request with an authorization error

### Requirement: Agent reasoning loop with function calling
The Edge Function SHALL use a Gemini reasoning model to run a multi-turn reasoning loop with a maximum of 5 iterations. Each iteration MAY emit text output or call the `generate_image` tool.

#### Scenario: Agent produces text-only response
- **WHEN** the model responds with text and no tool call
- **THEN** the function SHALL stream one or more `text` events
- **AND** SHALL end the reasoning loop

#### Scenario: Agent calls generate_image tool
- **WHEN** the model emits a `generate_image` function call
- **THEN** the function SHALL stream a `tool_start` event
- **AND** SHALL execute shared image generation logic
- **AND** SHALL stream a `tool_result` event
- **AND** SHALL feed the result into the next reasoning step

#### Scenario: Agent reaches maximum iterations
- **WHEN** the reasoning loop reaches 5 iterations without completion
- **THEN** the function SHALL stop further iterations
- **AND** SHALL stream a final `done` event

### Requirement: SSE event protocol
The Agent Edge Function SHALL stream responses as Server-Sent Events using `data: {JSON}\n\n` format. Supported event types are `text`, `tool_start`, `tool_result`, `error`, and `done`.

#### Scenario: Successful agent flow with image generation
- **WHEN** the agent reasons, calls `generate_image`, and finishes successfully
- **THEN** the SSE stream SHALL contain one or more `text` events, a `tool_start` event, a `tool_result` event with the generated image URL, and a final `done` event

#### Scenario: Error during processing
- **WHEN** an error occurs during reasoning or tool execution
- **THEN** the function SHALL stream an `error` event
- **AND** SHALL close the stream

### Requirement: Agent conversation history persistence
The system SHALL persist Gemini-format Agent conversation history in the `agent_sessions` table keyed by `conversation_id`. History SHALL be loaded at the start of the request and saved after a successful turn.

#### Scenario: First message in a conversation
- **WHEN** a user sends the first Agent message in a conversation
- **THEN** the function SHALL create a new `agent_sessions` row
- **AND** SHALL initialize history with the system context and user prompt

#### Scenario: Subsequent message with history
- **WHEN** a conversation already has Agent history
- **THEN** the function SHALL load the prior history
- **AND** SHALL append the new user prompt before calling Gemini
- **AND** SHALL save the updated history after completion

#### Scenario: History truncation for long conversations
- **WHEN** the stored history exceeds the configured retention window
- **THEN** the function SHALL truncate older turns
- **AND** SHALL preserve the system context

### Requirement: Agent image tool reuses shared image generation services
When the Agent calls `generate_image`, it SHALL reuse the shared Gemini image generation services also used by the existing `generate-image` flow, rather than implementing a separate image pipeline.

#### Scenario: Shared provider path
- **WHEN** the Agent invokes `generate_image`
- **THEN** the system SHALL reuse shared provider resolution, reference-image handling, asset upload, and error handling logic

#### Scenario: Shared asset output
- **WHEN** the image tool completes successfully
- **THEN** the generated image SHALL be uploaded into the project's asset storage
- **AND** the tool result SHALL include the uploaded image URL

### Requirement: Reference image security
If an Agent request includes `referenceImageUrl`, the backend SHALL only accept project-owned asset URLs or trusted storage origins.

#### Scenario: Trusted project asset reference
- **WHEN** `referenceImageUrl` points to a current project asset or trusted storage URL
- **THEN** the backend SHALL fetch and pass it to Gemini

#### Scenario: Untrusted external URL
- **WHEN** `referenceImageUrl` points to an untrusted external URL
- **THEN** the backend SHALL reject the request

### Requirement: Points deduction
The Agent Edge Function SHALL deduct points according to a dedicated Agent model entry in `ai_models`. Points SHALL be deducted per request, not per reasoning iteration.

#### Scenario: Sufficient points
- **WHEN** the user has enough points for the Agent model
- **THEN** the function SHALL deduct points once and proceed

#### Scenario: Insufficient points
- **WHEN** the user does not have enough points
- **THEN** the function SHALL return a structured `INSUFFICIENT_POINTS` error
- **AND** SHALL NOT start the reasoning loop

### Requirement: Retry mechanism
The Edge Function SHALL retry transient Gemini API failures with exponential backoff, up to 3 attempts.

#### Scenario: Transient Gemini API failure
- **WHEN** a Gemini API call fails initially and succeeds on retry
- **THEN** the function SHALL continue normally

#### Scenario: All retries exhausted
- **WHEN** retries are exhausted
- **THEN** the function SHALL stream an `error` event with a descriptive message

### Requirement: agent_sessions database table
The system SHALL have an `agent_sessions` table with the following schema: `conversation_id` (UUID, primary key, references `conversations(id)` with CASCADE delete), `history` (JSONB, default `'[]'`), `updated_at` (TIMESTAMPTZ, default `NOW()`).

#### Scenario: Table creation
- **WHEN** the migration is run
- **THEN** the `agent_sessions` table SHALL exist with the specified columns and constraints

#### Scenario: Direct client access is not exposed
- **WHEN** a regular client attempts to query `agent_sessions` directly
- **THEN** access SHALL be denied by policy

### Requirement: GEMINI_API_KEY secret
The Agent implementation SHALL read the Gemini API key from the existing `GEMINI_API_KEY` environment variable and SHALL NOT expose that key to the frontend.

#### Scenario: Key available
- **WHEN** `GEMINI_API_KEY` is configured
- **THEN** the Agent function SHALL initialize Gemini access successfully

#### Scenario: Key missing
- **WHEN** `GEMINI_API_KEY` is not configured
- **THEN** the function SHALL fail with a server configuration error
