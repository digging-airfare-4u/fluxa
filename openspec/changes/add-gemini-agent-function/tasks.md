## 1. Shared Backend Foundations

- [x] 1.1 Audit `generate-image` and `_shared` modules to identify the Gemini image generation logic that must be reused by both `generate-image` and `agent`
- [x] 1.2 Extract shared Gemini image generation utilities under `supabase/functions/_shared/` for provider resolution, reference-image preparation, asset upload, and normalized error handling, keeping points deduction and job lifecycle outside the shared core
- [x] 1.3 Refactor `supabase/functions/generate-image/index.ts` to use the extracted shared image generation core without changing the existing jobs-based contract or current image-model billing behavior
- [x] 1.4 Add or update shared backend tests covering the extracted Gemini image generation utilities and preserving the current `generate-image` output contract

## 2. Agent Data Model And Pricing

- [x] 2.1 Add a Supabase migration for the `agent_sessions` table keyed by `conversation_id` with `history` JSONB and `updated_at` columns
- [x] 2.2 Add the required RLS / access policy setup so `agent_sessions` is only accessed from server-side execution paths
- [x] 2.3 Add or update `ai_models` seed data, schema, and related queries so Agent mode has a dedicated system model entry for pricing and display while remaining hidden from the classic `ModelSelector` (for example via an `is_agent_only` flag or equivalent)
- [x] 2.4 Extend Agent model configuration semantics or schema so planner / executor role expansion is possible without exposing those models in classic selector flows
- [x] 2.5 Add migration and query tests covering `agent_sessions` schema expectations, Agent model pricing lookup behavior, role/config resolution, and exclusion of Agent-only models from classic selector queries

## 3. Agent Edge Function

- [x] 3.1 Create `supabase/functions/agent/index.ts` with request validation for `projectId`, `documentId`, `conversationId`, `prompt`, and optional `aspectRatio`, `resolution`, `referenceImageUrl`
- [x] 3.2 Implement authentication, project / document / conversation ownership checks, cross-entity consistency validation, and trusted reference image URL validation in the Agent Edge Function
- [x] 3.3 Implement the Agent orchestration as hand-written state transitions with explicit node boundaries, without introducing `LangChain` or `LangGraph` runtime dependencies in this phase
- [x] 3.4 Implement a planner node that produces structured plan output and decides whether search, image search, or direct execution is needed
- [x] 3.5 Implement an executor node that consumes planner output and drives tool execution toward a final answer
- [x] 3.6 Implement the core execution loop with a maximum iteration limit and explicit termination conditions
- [x] 3.7 Implement structured SSE event emission for `phase`, `plan`, `step_start`, `step_done`, `decision`, `tool_start`, `tool_result`, `citation`, `text`, `error`, and `done`
- [x] 3.8 Implement retry / exponential backoff handling for transient planner, executor, and tool-call failures
- [x] 3.9 Add `web_search(query)` support that returns structured candidate results with title, URL, and domain
- [x] 3.10 Add controlled result-fetching / verification support so selected search results can be fetched before final use
- [x] 3.11 Add `image_search(query)` support that returns structured candidate images and source-page references
- [x] 3.12 Add search-image ingestion support that validates external images and converts them into trusted temporary or project assets
- [x] 3.13 Ensure search result cards/snippets remain unverified until fetched content has been processed and citations can be produced
- [x] 3.14 Implement `generate_image` tool execution in the Agent function by reusing the extracted shared Gemini image generation core without triggering a second image-model points deduction after the request-level Agent charge
- [x] 3.15 Implement `agent_sessions` history load for existing Agent conversations
- [x] 3.16 Implement bootstrap-from-messages for the first Agent turn in an existing classic conversation
- [x] 3.17 Implement history truncation / retention behavior while preserving system context
- [x] 3.18 Implement `agent_sessions` save/update behavior after each successful Agent turn
- [x] 3.19 Persist the base successful Agent assistant turn into `messages` with `mode`, `modelName`, and final content
- [x] 3.20 Extend persisted Agent message metadata with citations, process/search summaries, and generated image references needed for reload/realtime rendering
- [x] 3.21 Add Edge Function tests for validation errors and authorization failures
- [x] 3.22 Add Edge Function tests for planner decisions, execution loop limits, and structured SSE event ordering
- [x] 3.23 Add Edge Function tests for verified citation output, search-image ingestion behavior, and no-double-charge image tool execution
- [x] 3.24 Add Edge Function tests for history bootstrap/load/save/truncation, assistant message persistence, and insufficient points handling

## 4. Chat Mode State And UI

- [x] 4.1 Extend `useChatStore` with `chatMode`, `setChatMode`, and persistence logic while preserving the existing classic-mode selected model state
- [x] 4.2 Add a mode selector component in `src/components/chat/ChatInput.tsx` for `classic` and `agent`
- [x] 4.3 Update ChatInput toolbar visibility rules so classic mode keeps current controls while Agent shows only the intended controls
- [x] 4.4 Add or update i18n strings and UI tests for the new chat modes, labels, mode persistence behavior, and the absence of Agent-only models from the classic selector

## 5. Agent Process Visualization And Frontend Routing

- [x] 5.1 Extend `src/lib/api/generate.ts` with an Agent SSE client that authenticates correctly, parses structured process events, and exposes the persisted final message payload carried by the `done` event
- [x] 5.2 Add Agent-mode generation flow in `src/hooks/chat/useGeneration.ts` and/or a dedicated hook for the Agent SSE connection lifecycle and abort handling
- [x] 5.3 Add frontend Agent state handling for process timeline events, including phase, plan steps, decisions, tool activity, citations, and partial text
- [x] 5.4 Add pending-message replacement logic that swaps the local pending message with the backend-persisted final message payload from `done`
- [x] 5.5 Update `src/components/chat/ChatPanel.tsx` so classic mode preserves the current model-based routing and Agent mode calls the new Agent path
- [x] 5.6 Add or update chat message UI components to render an expandable Agent process panel showing phase, plan steps, and status transitions
- [x] 5.7 Extend chat message UI components to render decisions, tool activity, citations, and generated/ingested images without exposing raw chain-of-thought
- [x] 5.8 Extend `src/lib/supabase/queries/messages.ts` metadata typing and chat rendering so Agent responses persist and display `mode`, `modelName`, thinking text, citations, process summaries, search summaries, and generated image references correctly
- [x] 5.9 Update classic model loading / resolution code so Agent-only `ai_models` entries are excluded from `fetchModels` and `resolveSelectableModels`, while Agent mode can still resolve its display name and pricing metadata server-side
- [x] 5.10 Ensure the Agent frontend path does not call `createMessage` for the final assistant turn after the backend has already persisted it
- [x] 5.11 Add frontend tests covering timeline event state updates and final message replacement for Agent turns
- [x] 5.12 Add frontend tests covering search decision visibility, citations rendering, and generated/ingested image display for Agent turns

## 6. Classic Image Generation Preservation

- [x] 6.1 Ensure classic mode continues to reuse the existing `generate-image` contract with Gemini image model, aspect ratio, resolution, and optional referenced asset URL
- [x] 6.2 Preserve the existing placeholder, job subscription, smart placement, local-op deduplication, and `saveOp` behavior for classic-mode image generation after the Agent changes land
- [x] 6.3 Ensure classic-mode image generation only accepts project-owned or trusted reference image URLs and surfaces failures through the current image generation error path
- [x] 6.4 Add frontend regression tests covering classic-mode Gemini image routing, placeholder lifecycle, and referenced asset handling

## 7. Verification

- [x] 7.1 Run targeted backend tests for Agent orchestration, planner/executor routing, search verification, and shared Gemini image generation behavior
- [x] 7.2 Run targeted frontend tests for Agent process visualization, pending/final message replacement, and classic-mode image generation regression behavior
- [ ] 7.3 Perform an end-to-end manual verification of both chat modes to confirm classic behavior is unchanged, Agent process visualization works, and Agent search/citation behavior matches the spec
- [x] 7.4 Update any related OpenSpec artifacts or implementation notes if final implementation details differ from the design during execution

### Verification Notes

- 2026-03-16: The `agent` Edge Function has been deployed to project `hlltfxrqhuzwtsxzkbmb`, CORS preflight now returns `200`, and authenticated requests reach the SSE handler. Manual Agent E2E verification is still blocked because the remote runtime returns `Gemini request failed ... API_KEY_INVALID`, indicating the configured `GEMINI_API_KEY` is not valid. Frontend transport-error recovery was hardened so Agent/classic requests now exit loading state and surface the error instead of remaining stuck.
- 2026-03-16: The implementation was extended so Agent brain selection is configurable. User provider configs now support `model_type = chat | image`; Agent mode resolves system chat models or BYOK chat configs via the shared provider layer instead of hard-wiring Gemini text calls; classic `generate-ops` also accepts BYOK chat configs.
