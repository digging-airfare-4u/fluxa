# Requirements Document

## Introduction

将 Fluxa 中所有 AI 提供商（文本生成和图像生成）的调用统一为 OpenAI 兼容的 API 格式。当前代码中存在多种不同的请求/响应格式（Anthropic 原生格式、Gemini 原生格式、火山引擎 OpenAI 兼容格式、OpenAI 原生格式），导致新增提供商时需要编写大量适配代码。重构后，所有提供商调用都将通过统一的 OpenAI 兼容接口进行，简化扩展和维护。

## Glossary

- **Chat_Provider**: 处理文本/Ops 生成的 AI 提供商适配器，实现 OpenAI 兼容的 Chat Completions 接口
- **Image_Provider**: 处理图像生成的 AI 提供商适配器，实现统一的图像生成接口
- **Provider_Registry**: 管理所有已注册提供商和模型配置的中心注册表
- **OpenAI_Compatible_Client**: 统一的 HTTP 客户端，发送 OpenAI 格式的请求并解析 OpenAI 格式的响应
- **Provider_Config**: 描述单个提供商连接信息的配置对象（API URL、认证方式、模型映射等）
- **Model_Config**: 描述单个模型的配置（所属提供商、模型 ID、能力声明等）

## Requirements

### Requirement 1: 统一的 Chat Provider 接口

**User Story:** As a developer, I want a unified chat provider interface using OpenAI-compatible format, so that all text generation providers can be called through the same code path.

#### Acceptance Criteria

1. THE Chat_Provider SHALL define a common interface with `chatCompletion(messages, options)` method that accepts OpenAI-format messages and returns OpenAI-format responses
2. WHEN a chat completion request is made, THE OpenAI_Compatible_Client SHALL send a POST request to the provider's chat completions endpoint with `{ model, messages, temperature, max_tokens }` format
3. WHEN a chat completion response is received, THE OpenAI_Compatible_Client SHALL parse the response into a unified `{ choices: [{ message: { role, content } }] }` structure
4. WHEN the Anthropic provider is used, THE Chat_Provider SHALL translate the OpenAI-format request to Anthropic's native format and translate the Anthropic response back to OpenAI format
5. WHEN the Volcengine provider is used, THE Chat_Provider SHALL send the request directly to the OpenAI-compatible endpoint without translation
6. WHEN the OpenAI provider is used, THE Chat_Provider SHALL send the request directly to the OpenAI endpoint without translation

### Requirement 2: 统一的 Image Provider 接口

**User Story:** As a developer, I want a unified image provider interface, so that all image generation providers share the same request/response contract.

#### Acceptance Criteria

1. THE Image_Provider SHALL define a common interface with `generate(request)` method that accepts a unified `ProviderRequest` and returns a unified `ImageResult`
2. WHEN the Gemini image provider is configured in OpenAI-compatible mode (default), THE Image_Provider SHALL send requests to the OpenAI-format `/v1/images/generations` endpoint (e.g., via OpenRouter) and parse the standard OpenAI image response format containing `{ data: [{ url?, b64_json? }] }`
3. WHEN the Gemini image provider is configured in native mode, THE Image_Provider SHALL use the existing Gemini `generateContent` API as a fallback
4. THE Gemini image provider SHALL support a configurable `apiMode` switch (`'openai' | 'native'`) that determines which API format to use, defaulting to `'openai'`
5. WHEN the Volcengine image provider is used, THE Image_Provider SHALL send the request to the OpenAI-compatible images endpoint and translate the response to the unified format
6. WHEN a new image provider is added, THE Image_Provider interface SHALL require only implementing the `generate` and `validateRequest` methods without modifying existing provider code

### Requirement 3: Provider Registry 和模型配置

**User Story:** As a developer, I want a centralized provider registry, so that adding a new provider or model only requires adding a configuration entry.

#### Acceptance Criteria

1. THE Provider_Registry SHALL maintain a mapping from model names to their Provider_Config and Model_Config
2. WHEN a model name is provided, THE Provider_Registry SHALL return the corresponding provider instance capable of handling the request
3. WHEN an unsupported model name is provided, THE Provider_Registry SHALL return a descriptive error indicating the model is not registered
4. THE Provider_Registry SHALL support registering both chat providers and image providers through a unified registration mechanism
5. WHEN a new provider is registered, THE Provider_Registry SHALL validate that the Provider_Config contains all required fields (apiUrl, authType, modelId)
6. THE Provider_Config SHALL support an optional `apiMode` field (`'openai' | 'native'`) to indicate whether a provider should use OpenAI-compatible or native API format

### Requirement 4: Provider Config 序列化

**User Story:** As a developer, I want provider configurations to be serializable, so that they can be stored, loaded, and validated consistently.

#### Acceptance Criteria

1. THE Provider_Config SHALL be serializable to JSON and deserializable back to an equivalent Provider_Config object
2. WHEN a Provider_Config is serialized then deserialized, THE Provider_Registry SHALL produce an object equivalent to the original
3. WHEN an invalid Provider_Config JSON is provided, THE Provider_Registry SHALL return a validation error listing the missing or invalid fields

### Requirement 5: generate-ops 函数重构

**User Story:** As a developer, I want the generate-ops Edge Function to use the unified chat provider interface, so that provider-specific branching logic is eliminated from the function body.

#### Acceptance Criteria

1. WHEN the generate-ops function receives a request, THE generate-ops function SHALL resolve the provider through the Provider_Registry based on the model name
2. WHEN calling the AI provider, THE generate-ops function SHALL use the Chat_Provider interface instead of inline provider-specific request building
3. WHEN the AI provider returns a response, THE generate-ops function SHALL parse the response through the unified OpenAI-format response parser
4. IF the resolved provider returns an error, THEN THE generate-ops function SHALL propagate the error with provider name and model name context

### Requirement 6: generate-image 函数重构

**User Story:** As a developer, I want the generate-image Edge Function to use the unified image provider interface through the registry, so that provider selection is centralized.

#### Acceptance Criteria

1. WHEN the generate-image function receives a request, THE generate-image function SHALL resolve the image provider through the Provider_Registry based on the model name
2. WHEN calling the image provider, THE generate-image function SHALL use the Image_Provider interface instead of direct provider class instantiation with if/else branching
3. IF the resolved provider returns an error, THEN THE generate-image function SHALL propagate the error with provider name and model name context

### Requirement 7: 清理遗留代码

**User Story:** As a developer, I want legacy duplicate provider code removed, so that there is a single source of truth for each provider implementation.

#### Acceptance Criteria

1. WHEN the refactoring is complete, THE codebase SHALL contain only one Gemini provider implementation (in `_shared/providers/gemini.ts`), and the legacy `_shared/gemini-provider.ts` SHALL be removed
2. WHEN the refactoring is complete, THE generate-ops function SHALL contain no inline `MODEL_CONFIGS` map or provider-specific request/response building logic
3. THE codebase SHALL have no duplicate type definitions for provider-related types across files

### Requirement 8: 错误处理统一

**User Story:** As a developer, I want consistent error handling across all providers, so that errors are predictable and debuggable regardless of which provider is used.

#### Acceptance Criteria

1. WHEN any provider API call fails with an HTTP error, THE OpenAI_Compatible_Client SHALL throw a ProviderError containing the HTTP status code, provider name, model name, and error message
2. WHEN any provider API call returns an unparseable response, THE OpenAI_Compatible_Client SHALL throw a ProviderError with error code `INVALID_RESPONSE` and include the raw response text
3. WHEN any provider API key is missing, THE Provider_Registry SHALL throw a ProviderError with error code `MISSING_API_KEY` and the provider name
4. IF a provider request times out, THEN THE OpenAI_Compatible_Client SHALL throw a ProviderError with error code `TIMEOUT` and the provider name

### Requirement 9: 向后兼容

**User Story:** As a developer, I want the refactoring to maintain backward compatibility, so that existing frontend code and API contracts continue to work without changes.

#### Acceptance Criteria

1. WHEN the generate-ops Edge Function is called with existing request format, THE generate-ops function SHALL return responses in the same format as before the refactoring
2. WHEN the generate-image Edge Function is called with existing request format, THE generate-image function SHALL return responses in the same format as before the refactoring
3. THE refactoring SHALL preserve all existing model names as valid inputs to both Edge Functions
4. THE refactoring SHALL preserve the existing environment variable names for API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, VOLCENGINE_API_KEY, GEMINI_API_KEY)
