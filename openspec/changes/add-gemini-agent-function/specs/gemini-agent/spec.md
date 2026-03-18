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
The Agent Edge Function SHALL verify the user's identity from the `Authorization` header and SHALL verify access to the referenced project, document, and conversation before processing. It SHALL also verify that the referenced conversation and document both belong to the specified project.

#### Scenario: Valid user and conversation access
- **WHEN** a request includes a valid JWT and the conversation belongs to the specified project
- **THEN** the function SHALL proceed with processing

#### Scenario: Invalid conversation ownership
- **WHEN** a request references a conversation outside the current user's accessible project scope
- **THEN** the function SHALL reject the request with an authorization error

#### Scenario: Invalid document ownership or project mismatch
- **WHEN** a request references a `documentId` the user cannot access
- **OR** the referenced `documentId` does not belong to `projectId`
- **OR** the referenced `conversationId` does not belong to `projectId`
- **THEN** the function SHALL reject the request before the reasoning loop starts

### Requirement: Agent reasoning loop with function calling
The Edge Function SHALL use a configurable chat provider runtime to run a multi-turn reasoning loop with a maximum of 5 iterations. Each iteration MAY emit text output or call the `generate_image` tool.

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

### Requirement: Planner and executor stages
The Agent implementation SHALL support a planning stage and an execution stage under the single `agent` mode. The planner SHALL decide whether search or other tools are needed before the executor performs tool calls and produces the final response.

#### Scenario: Planner decides no search is needed
- **WHEN** the planner determines the request can be answered from current conversation context and available tools without external search
- **THEN** the execution stage SHALL proceed without invoking `web_search` or `image_search`

#### Scenario: Planner decides search is needed
- **WHEN** the planner determines the request depends on external facts, freshness, or visual reference discovery
- **THEN** it SHALL mark search as required before the executor continues
- **AND** the subsequent execution stage MAY invoke the required search tools

### Requirement: SSE event protocol
The Agent Edge Function SHALL stream responses as Server-Sent Events using `data: {JSON}\n\n` format. Supported event types include structured process events for phases, plan steps, decisions, tools, citations, text, errors, and `done`.

#### Scenario: Successful agent flow with image generation
- **WHEN** the agent reasons, calls `generate_image`, and finishes successfully
- **THEN** the SSE stream SHALL contain one or more `text` events, a `tool_start` event, a `tool_result` event with the generated image URL, and a final `done` event

#### Scenario: Structured process events are streamed
- **WHEN** the Agent processes a request
- **THEN** the stream SHALL emit machine-readable process events describing the current phase, plan or step status, and key decisions made during execution
- **AND** those events SHALL be suitable for direct frontend visualization without exposing raw chain-of-thought

#### Scenario: Final done event carries persisted message payload
- **WHEN** the Agent completes a turn successfully
- **THEN** the final `done` event SHALL include the persisted `assistant` message identifier
- **AND** SHALL include the final message content and metadata needed by the frontend to replace its pending message without creating a second assistant row

#### Scenario: Error during processing
- **WHEN** an error occurs during reasoning or tool execution
- **THEN** the function SHALL stream an `error` event
- **AND** SHALL close the stream

### Requirement: Agent conversation history persistence
The system SHALL persist provider-agnostic Agent conversation history in the `agent_sessions` table keyed by `conversation_id`. History SHALL be loaded at the start of the request and saved after a successful turn.

#### Scenario: First message in a conversation
- **WHEN** a user sends the first Agent message in a conversation with no existing `agent_sessions` row
- **THEN** the function SHALL create a new `agent_sessions` row
- **AND** SHALL initialize history with the system context, bootstrap context derived from recent visible `messages` in that conversation, and the new user prompt

#### Scenario: First Agent turn after prior classic conversation
- **WHEN** the conversation already contains prior user-visible chat messages from classic mode
- **AND** no `agent_sessions` history exists yet
- **THEN** the function SHALL derive bootstrap context from those persisted `messages`
- **AND** SHALL NOT start from only the latest prompt

#### Scenario: Subsequent message with history
- **WHEN** a conversation already has Agent history
- **THEN** the function SHALL load the prior history
- **AND** SHALL append the new user prompt before calling the selected runtime provider
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

### Requirement: Agent search tools
The Agent SHALL support external search tools under the `agent` mode, including at least webpage search, result fetching, and image search.

#### Scenario: Web search is invoked
- **WHEN** the planner or executor decides external factual lookup is required
- **THEN** the Agent MAY invoke `web_search`
- **AND** SHALL receive a structured list of candidate results including title, URL, and source domain

#### Scenario: Search result content is fetched
- **WHEN** a candidate web result is selected for verification
- **THEN** the Agent SHALL fetch the result content through a controlled backend fetch step before relying on it in the final answer

#### Scenario: Image search is invoked
- **WHEN** the planner or executor decides visual reference discovery is required
- **THEN** the Agent MAY invoke `image_search`
- **AND** SHALL receive a structured list of candidate images and their source pages

### Requirement: Search results must be verified before final use
Search engine snippets, titles, and image thumbnails SHALL be treated as unverified leads rather than final facts.

#### Scenario: Unverified search card is insufficient
- **WHEN** a search result has only title/snippet metadata and its page has not been fetched
- **THEN** the Agent SHALL NOT treat that result as sufficient evidence for a factual final answer

#### Scenario: Verified result is cited
- **WHEN** the Agent uses information from a fetched and validated source
- **THEN** the final answer metadata SHALL include a citation for that source

### Requirement: External search images are ingested before model use
If the Agent wants to use an externally discovered search image as model input or reference context, the image SHALL first be downloaded, validated, and converted into a trusted temporary or project asset.

#### Scenario: Search image becomes trusted input
- **WHEN** `image_search` returns an external image URL and the Agent chooses to use it
- **THEN** the backend SHALL validate and ingest that image before passing it to the model
- **AND** the model SHALL receive the trusted ingested asset rather than the raw external URL

#### Scenario: Search image ingestion fails
- **WHEN** the external image cannot be validated or ingested
- **THEN** the Agent SHALL treat that image as unavailable
- **AND** SHALL NOT pass the raw external URL to the model

### Requirement: Reference image security
If an Agent request includes `referenceImageUrl`, the backend SHALL only accept project-owned asset URLs or trusted storage origins.

#### Scenario: Trusted project asset reference
- **WHEN** `referenceImageUrl` points to a current project asset or trusted storage URL
- **THEN** the backend SHALL fetch and pass it to the selected runtime provider

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

#### Scenario: Agent image tool does not trigger second model deduction
- **WHEN** the Agent request has already passed request-level points deduction
- **AND** the reasoning loop invokes `generate_image`
- **THEN** the shared image generation path SHALL run without deducting an additional image-model charge for that same request

#### Scenario: Validation or authorization fails before processing
- **WHEN** the request is rejected before the reasoning loop starts
- **THEN** the system SHALL NOT deduct any points

### Requirement: Retry mechanism
The Edge Function SHALL retry transient runtime-provider API failures with exponential backoff, up to 3 attempts.

#### Scenario: Transient runtime-provider API failure
- **WHEN** a runtime-provider API call fails initially and succeeds on retry
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

### Requirement: Agent assistant messages are persisted in messages
Each successful Agent turn SHALL persist exactly one final `assistant` message in the existing `messages` table for the conversation. `agent_sessions` SHALL NOT be the only persisted record of the turn.

#### Scenario: Text-only Agent response
- **WHEN** the Agent completes a turn with text output only
- **THEN** the system SHALL persist an `assistant` message in `messages`
- **AND** `metadata.mode` SHALL be `'agent'`
- **AND** `metadata.modelName` SHALL identify the Agent model used

#### Scenario: Agent response includes image generation
- **WHEN** the Agent completes a turn after calling `generate_image`
- **THEN** the persisted `assistant` message SHALL include the final text content
- **AND** metadata SHALL include `mode: 'agent'`
- **AND** metadata SHALL include the generated image reference or URL needed for later rendering

#### Scenario: Agent response includes verified search sources
- **WHEN** the Agent completes a turn after using verified search results
- **THEN** the persisted message metadata SHALL include the citations needed for later rendering
- **AND** MAY include process or search summaries derived from the structured Agent events

#### Scenario: Partial stream is interrupted
- **WHEN** the SSE stream fails or is aborted before a successful final turn is produced
- **THEN** the system SHALL NOT persist a partial assistant message as a completed response

#### Scenario: Frontend does not create a duplicate final message
- **WHEN** the backend has already persisted the successful Agent response into `messages`
- **THEN** the frontend SHALL use the persisted message payload from the stream to replace its local pending state
- **AND** SHALL NOT create a second final `assistant` message for that same turn

### Requirement: Configurable Agent runtime provider
The Agent implementation SHALL support both system chat models and user-configured `chat` provider configs as its runtime provider, and SHALL NOT expose any provider secret to the frontend.

#### Scenario: System model selected
- **WHEN** a system chat model is selected for Agent mode
- **THEN** the Agent function SHALL resolve that runtime from the shared provider registry

#### Scenario: BYOK chat config selected
- **WHEN** a `user:{configId}` model referring to a saved `chat` provider config is selected
- **THEN** the Agent function SHALL resolve that config through the existing encrypted user-provider storage
- **AND** SHALL reject the request if the config is missing, disabled, or not configured for `chat`
