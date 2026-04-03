## ADDED Requirements

### Requirement: ReAct loop replaces planner/executor
The Agent SHALL use a single ReAct (Reason + Act) loop instead of separate planner and executor LLM calls. Each iteration of the loop SHALL make one LLM call that either produces a text response (end turn) or one or more tool calls.

#### Scenario: Simple text response
- **WHEN** the user sends a greeting like "你好"
- **THEN** the Agent SHALL make exactly one LLM call that returns a text response with no tool calls

#### Scenario: Tool call followed by final response
- **WHEN** the user asks "搜索今天的天气"
- **THEN** the Agent SHALL make one LLM call that returns a `web_search` tool call, execute the tool, feed the result back, and make a second LLM call that returns the final text response

#### Scenario: Multiple tool calls in sequence
- **WHEN** the user asks a question requiring web search followed by URL verification
- **THEN** the Agent SHALL execute tool calls one at a time, feeding each result back to the LLM, until the LLM returns a text response (end turn)

#### Scenario: Max iterations exceeded
- **WHEN** the tool call loop reaches the configured maximum iterations (default: 10)
- **THEN** the Agent SHALL stop the loop and return whatever partial response is available with a note that the iteration limit was reached

### Requirement: Tool registry
The Agent SHALL use a tool registry pattern where each tool is a self-describing object containing name, description, input schema, and handler function. The core loop SHALL NOT contain tool-specific branching logic.

#### Scenario: Tool registration
- **WHEN** a tool is registered with `{ name, description, inputSchema, handler }`
- **THEN** the tool's schema SHALL be included in LLM requests and the handler SHALL be invoked when the LLM calls that tool

#### Scenario: Unknown tool returned by LLM
- **WHEN** the LLM returns a tool call with a name not in the registry
- **THEN** the Agent SHALL return an error tool result to the LLM indicating the tool does not exist, and the loop SHALL continue (not crash)

#### Scenario: Adding a new tool
- **WHEN** a developer adds a new tool to the registry
- **THEN** no changes SHALL be required in the core loop, SSE event handling, or history management

### Requirement: SSE event protocol
The Agent SHALL stream progress via SSE events. The event protocol SHALL include: `tool_start`, `tool_result`, `text_delta`, `text`, `done`, and `error` event types.

#### Scenario: Text response streaming
- **WHEN** the LLM produces a text response
- **THEN** the Agent SHALL emit a `text` event with the complete response content, and a `done` event with the persisted message

#### Scenario: Tool execution progress
- **WHEN** the LLM requests a tool call
- **THEN** the Agent SHALL emit `tool_start` (with tool name and input summary) before execution and `tool_result` (with result summary) after execution

#### Scenario: Error during execution
- **WHEN** an unrecoverable error occurs during the ReAct loop
- **THEN** the Agent SHALL emit an `error` event with a descriptive message before closing the stream

#### Scenario: Removed events
- **WHEN** a client sends an agent request
- **THEN** the Agent SHALL NOT emit `plan`, `decision`, `phase`, `step_start`, or `step_done` events (these are removed from the protocol)

### Requirement: History management
The Agent SHALL persist conversation history in the `agent_sessions` table. History entries SHALL support roles: `system`, `user`, `assistant`, and `tool`. Assistant entries MAY include `tool_calls` metadata.

#### Scenario: History persistence after successful response
- **WHEN** the Agent completes a ReAct loop successfully
- **THEN** the full conversation history (including tool call/result pairs) SHALL be saved to `agent_sessions` with truncation applied (max 24 entries, system messages preserved)

#### Scenario: Loading history with tool call entries
- **WHEN** a follow-up message arrives and the session contains `tool_calls` entries from a previous turn
- **THEN** the Agent SHALL load the full history including tool entries and pass them to the LLM as proper context

#### Scenario: Backward compatibility with old history format
- **WHEN** the Agent loads a session saved by the old planner/executor architecture (no tool_calls entries, only plain role/content)
- **THEN** the Agent SHALL treat these as valid history entries and continue normally

### Requirement: Points deduction timing
The Agent SHALL deduct points before execution starts (maintaining current behavior). If the Agent loop fails completely with zero useful output, the failure SHALL be logged for potential manual refund review.

#### Scenario: Successful execution
- **WHEN** the Agent completes the ReAct loop and produces a response
- **THEN** points SHALL have been deducted before execution began

#### Scenario: Failed execution
- **WHEN** the Agent fails during execution after points were deducted
- **THEN** the failure SHALL be logged with `conversation_id`, `user_id`, and error details for operational review
