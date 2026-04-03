## ADDED Requirements

### Requirement: Native tool use for OpenAI-compatible providers
The Agent SHALL send tool definitions via the OpenAI `tools` field in chat completion requests for system-managed OpenAI-compatible providers (Volcengine, OpenAI). The LLM response's `tool_calls` field SHALL be used to determine tool invocations instead of parsing JSON from message content.

#### Scenario: Provider receives tool definitions
- **WHEN** the Agent makes an LLM call through an OpenAI-compatible system provider
- **THEN** the request body SHALL include a `tools` array with each registered tool's name, description, and JSON schema parameters, and `tool_choice` set to `"auto"`

#### Scenario: LLM returns a tool call
- **WHEN** the provider response contains `choices[0].message.tool_calls`
- **THEN** the Agent SHALL extract the tool name and parsed arguments from each `tool_calls` entry and invoke the corresponding tool handler

#### Scenario: Tool result fed back to LLM
- **WHEN** a tool execution completes
- **THEN** the result SHALL be appended to messages as a `tool` role message with `tool_call_id` matching the original call, and the next LLM call SHALL include this message

### Requirement: Native tool use for Anthropic-compatible providers
The Agent SHALL send tool definitions via the Anthropic `tools` field in Messages API requests for system-managed Anthropic providers. Tool calls SHALL be extracted from `tool_use` content blocks in the response.

#### Scenario: Provider receives tool definitions (Anthropic format)
- **WHEN** the Agent makes an LLM call through an Anthropic-compatible system provider
- **THEN** the request body SHALL include a `tools` array with each tool's name, description, and `input_schema` (JSON Schema format)

#### Scenario: LLM returns a tool_use block
- **WHEN** the provider response contains a content block with `type: "tool_use"`
- **THEN** the Agent SHALL extract the tool name and input from the block and invoke the corresponding handler

#### Scenario: Tool result fed back to LLM (Anthropic format)
- **WHEN** a tool execution completes for an Anthropic provider
- **THEN** the result SHALL be sent as a `user` role message containing a `tool_result` content block with the matching `tool_use_id`

### Requirement: JSON prompt fallback for BYOK providers
The Agent SHALL detect whether a BYOK (user-configured) provider supports native tool use. If the provider does not support it, the Agent SHALL fall back to prompt-based JSON tool calling (embedding tool schemas in the system prompt and parsing JSON from the LLM's text response).

#### Scenario: BYOK provider with tool use support
- **WHEN** a user-configured provider is `openai-compatible` and the provider endpoint accepts `tools` in the request body without error
- **THEN** the Agent SHALL use the native OpenAI tool use path

#### Scenario: BYOK provider without tool use support
- **WHEN** a user-configured provider fails or returns an error when `tools` is included in the request
- **THEN** the Agent SHALL retry WITHOUT the `tools` field, embedding tool schemas in the system prompt instead, and parse tool calls from the LLM's JSON text response

#### Scenario: Fallback JSON parsing produces invalid output
- **WHEN** the BYOK fallback path parses the LLM's response and the JSON does not match any known tool schema
- **THEN** the Agent SHALL treat the response as a plain text reply (not a tool call) and return it to the user

### Requirement: Tool definition schema
Each tool registered with the Agent SHALL declare its interface using a standard schema object that can be translated to both OpenAI and Anthropic tool formats.

#### Scenario: Tool schema structure
- **WHEN** a tool is defined
- **THEN** it SHALL include `name` (string), `description` (string), `inputSchema` (JSON Schema object), and `handler` (async function)

#### Scenario: Schema translation to OpenAI format
- **WHEN** a tool is sent to an OpenAI-compatible provider
- **THEN** it SHALL be formatted as `{ type: "function", function: { name, description, parameters: inputSchema } }`

#### Scenario: Schema translation to Anthropic format
- **WHEN** a tool is sent to an Anthropic-compatible provider
- **THEN** it SHALL be formatted as `{ name, description, input_schema: inputSchema }`
