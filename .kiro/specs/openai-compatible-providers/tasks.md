# Implementation Plan: OpenAI-Compatible Providers

## Overview

Refactor all AI provider integrations to use a unified OpenAI-compatible API format. The implementation proceeds bottom-up: shared types → client → adapters → registry → Edge Function refactoring → cleanup. The Gemini image provider supports dual mode (OpenAI-compatible via OpenRouter by default, native Gemini API as fallback).

## Tasks

- [x] 1. Define shared types and interfaces
  - [x] 1.1 Create `supabase/functions/_shared/providers/chat-types.ts` with `ChatMessage`, `ChatCompletionOptions`, `ChatCompletionResult`, `ChatProvider` interface, `ProviderConfig` (including optional `apiMode` field), and `ModelConfig` types
    - All types as defined in the design document
    - `ProviderConfig.apiMode` is optional, typed as `'openai' | 'native'`
    - Export all types for use by providers and registry
    - _Requirements: 1.1, 3.1, 3.6_
  - [x] 1.2 Extend `ProviderError` in `supabase/functions/_shared/errors/index.ts` to include optional `providerName`, `modelName`, and `httpStatus` fields
    - Add fields to constructor and `toJSON()` output
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.3 Create `supabase/functions/_shared/providers/config-validator.ts` with `validateProviderConfig(input: unknown)` function that returns `{ valid: true, config: ProviderConfig } | { valid: false, errors: string[] }`
    - Validate required fields: `name`, `apiUrl`, `authType`, `apiKeyEnvVar`
    - Validate `authType` is one of `'bearer' | 'api-key-header'`
    - Validate optional `apiMode` is one of `'openai' | 'native'` when present
    - _Requirements: 3.5, 3.6, 4.3_
  - [ ]* 1.4 Write property tests for ProviderConfig validation and serialization
    - **Property 7: ProviderConfig validation catches missing fields**
    - **Property 8: ProviderConfig serialization round trip**
    - **Validates: Requirements 3.5, 3.6, 4.1, 4.2, 4.3**

- [x] 2. Implement OpenAICompatibleClient
  - [x] 2.1 Create `supabase/functions/_shared/providers/openai-client.ts` with `OpenAICompatibleClient` class
    - Constructor takes `OpenAIClientConfig` (apiUrl, apiKey, defaultHeaders)
    - `chatCompletion(model, messages, options)` method builds OpenAI-format request body, sends POST to `/chat/completions`, parses response
    - `imageGeneration(request)` method builds `{ model, prompt, n, size, response_format }` request body, sends POST to `/images/generations`, parses `{ data: [{ url?, b64_json? }] }` response
    - Throw `ProviderError` with `httpStatus`, `providerName` on HTTP errors
    - Throw `ProviderError` with code `INVALID_RESPONSE` on parse failures (for both `choices` and `data` structures)
    - _Requirements: 1.2, 1.3, 2.2, 8.1, 8.2_
  - [ ]* 2.2 Write property tests for OpenAICompatibleClient
    - **Property 1: OpenAI client request format**
    - **Property 2: OpenAI client response parsing**
    - **Property 9: HTTP errors produce ProviderError with required fields**
    - **Property 10: Unparseable responses produce ProviderError**
    - **Property 12: OpenAI image generation request format**
    - **Validates: Requirements 1.2, 1.3, 2.2, 8.1, 8.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement chat provider adapters
  - [x] 4.1 Create `supabase/functions/_shared/providers/openai-chat-provider.ts` implementing `ChatProvider`
    - Uses `OpenAICompatibleClient` directly
    - Passes messages through without modification
    - Reads API key from `OPENAI_API_KEY` env var
    - _Requirements: 1.6_
  - [x] 4.2 Create `supabase/functions/_shared/providers/volcengine-chat-provider.ts` implementing `ChatProvider`
    - Uses `OpenAICompatibleClient` directly
    - Formats content as array `[{ type: 'text', text }]` for Volcengine vision models
    - Reads API key from `VOLCENGINE_API_KEY` env var, API URL from `VOLCENGINE_API_URL` or default
    - _Requirements: 1.5_
  - [x] 4.3 Create `supabase/functions/_shared/providers/anthropic-chat-adapter.ts` implementing `ChatProvider`
    - Extracts system message from messages array into Anthropic `system` field
    - Builds Anthropic-format request with `x-api-key` and `anthropic-version` headers
    - Translates Anthropic response `content[0].text` back to `ChatCompletionResult`
    - Reads API key from `ANTHROPIC_API_KEY` env var
    - _Requirements: 1.4_
  - [ ]* 4.4 Write property tests for chat providers
    - **Property 3: Anthropic adapter translation preserves content**
    - **Property 4: OpenAI-compatible providers pass messages unchanged**
    - **Validates: Requirements 1.4, 1.5, 1.6**

- [x] 5. Implement GeminiImageProvider with dual-mode support
  - [x] 5.1 Refactor `supabase/functions/_shared/providers/gemini.ts` to support dual mode
    - Add `mode: 'openai' | 'native'` to constructor config, defaulting to `'openai'`
    - Read `GEMINI_IMAGE_API_MODE` env var to determine mode (`openai` or `native`)
    - In `openai` mode: use `OpenAICompatibleClient` to call `/v1/images/generations` with `{ model, prompt, n, size }`, read `GEMINI_IMAGE_API_URL` and `GEMINI_IMAGE_API_KEY` for endpoint config (e.g., OpenRouter)
    - In `native` mode: keep existing `generateContent` API logic unchanged
    - Parse OpenAI image response `{ data: [{ url?, b64_json? }] }` in openai mode, convert to `ImageResult`
    - Both modes implement the same `ImageProvider` interface
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 5.2 Write property tests for GeminiImageProvider dual mode
    - **Property 11: Gemini dual-mode dispatches to correct API**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 6. Implement ProviderRegistry
  - [x] 6.1 Create `supabase/functions/_shared/providers/registry.ts` with `ProviderRegistry` class
    - `registerChatModel(modelName, factory)` and `registerImageModel(modelName, factory)` methods
    - `getChatProvider(modelName)` and `getImageProvider(modelName)` methods
    - Throw `ProviderError` with `MODEL_NOT_SUPPORTED` for unknown models
    - `isSupported(modelName)` and `getSupportedModels()` utility methods
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.2 Create `supabase/functions/_shared/providers/registry-setup.ts` that instantiates a `ProviderRegistry` and registers all current models
    - Register OpenAI models: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
    - Register Anthropic models: `claude-3-haiku`, `claude-3-sonnet`
    - Register Volcengine chat model: `doubao-seed-1-6-vision-250815`
    - Register Gemini image models: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview` with mode from `GEMINI_IMAGE_API_MODE` env var (default: `openai`)
    - Register Volcengine image model: `doubao-seedream-4-5-251128`
    - Export `createRegistry(supabase)` factory function
    - _Requirements: 3.1, 3.6, 9.3_
  - [ ]* 6.3 Write property tests for ProviderRegistry
    - **Property 5: Registry register-then-retrieve**
    - **Property 6: Registry rejects unregistered models**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Refactor generate-ops Edge Function
  - [x] 8.1 Refactor `supabase/functions/generate-ops/index.ts` to use ProviderRegistry
    - Remove inline `MODEL_CONFIGS` map
    - Remove provider-specific branching in `callAIProvider()`
    - Replace with: resolve chat provider from registry → call `chatCompletion()` → parse result
    - Keep all existing request validation, points deduction, and response handling logic unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.2, 9.1_
  - [ ]* 8.2 Write unit tests for generate-ops backward compatibility
    - Test that existing request format produces same response structure
    - Test error propagation includes provider and model context
    - _Requirements: 5.4, 9.1_

- [x] 9. Refactor generate-image Edge Function
  - [x] 9.1 Refactor `supabase/functions/generate-image/index.ts` to use ProviderRegistry
    - Remove direct `GeminiProvider` and `VolcengineProvider` imports and if/else chain
    - Replace with: resolve image provider from registry → call `generate()` → use result
    - Gemini models will automatically use the correct mode (openai/native) based on registry config
    - Keep all existing validation, points, job, and asset logic unchanged
    - _Requirements: 6.1, 6.2, 6.3, 9.2_
  - [ ]* 9.2 Write unit tests for generate-image backward compatibility
    - Test that existing request format produces same response structure
    - Test error propagation includes provider and model context
    - _Requirements: 6.3, 9.2_

- [x] 10. Clean up legacy code
  - [x] 10.1 Delete `supabase/functions/_shared/gemini-provider.ts` (legacy duplicate)
    - Verify no remaining imports reference this file
    - _Requirements: 7.1_
  - [x] 10.2 Update `supabase/functions/_shared/providers/index.ts` barrel export to include all new modules
    - Export registry, chat types, chat providers, and client
    - _Requirements: 7.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All code is TypeScript targeting Deno runtime for Edge Functions and Vitest for tests
- Gemini image provider defaults to OpenAI-compatible mode (via OpenRouter), with native API as fallback controlled by `GEMINI_IMAGE_API_MODE` env var
- New env vars for Gemini OpenAI mode: `GEMINI_IMAGE_API_MODE`, `GEMINI_IMAGE_API_URL`, `GEMINI_IMAGE_API_KEY`
