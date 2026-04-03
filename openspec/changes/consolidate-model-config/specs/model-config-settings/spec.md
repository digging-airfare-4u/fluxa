## ADDED Requirements

### Requirement: System model defaults are runtime-configurable via system_settings table
The system SHALL support `default_chat_model`, `default_image_model`, and `agent_default_brain_model` keys in the `system_settings` table, enabling super-admins to change default models at runtime without redeploying edge functions.

#### Scenario: Super-admin updates default chat model
- **WHEN** a super-admin sets `default_chat_model` in `system_settings` to a valid model name
- **THEN** all subsequent generate-ops and agent requests that rely on the default SHALL use the updated model

#### Scenario: Super-admin updates default image model
- **WHEN** a super-admin sets `default_image_model` in `system_settings` to a valid model name
- **THEN** all subsequent generate-image, image-tools, and agent image generation requests that rely on the default SHALL use the updated model

### Requirement: Environment variables are reserved for infrastructure configuration only
Model-related environment variables SHALL be limited to API keys (`*_API_KEY`) and API base URLs (`*_API_URL`). Model name selection SHALL NOT be controlled by any environment variable — all model name overrides use `system_settings`.

#### Scenario: New model-related configuration needed
- **WHEN** a new feature requires configuring a default model name
- **THEN** the configuration SHALL be added to `system_settings` table, not as a new environment variable

### Requirement: Admin UI for model defaults in ProviderConfigPanel
The `ProviderConfigPanel` SHALL include a "默认模型" section visible only to super-admins, allowing configuration of all three model default settings (`default_chat_model`, `default_image_model`, `agent_default_brain_model`) alongside provider configurations.

#### Scenario: Super-admin opens ProviderConfigPanel
- **WHEN** a super-admin opens the Provider 配置 panel
- **THEN** a "默认模型" section SHALL appear at the top, showing current values for default chat model, default image model, and Agent Brain model override

#### Scenario: Non-admin opens ProviderConfigPanel
- **WHEN** a non-admin user opens the Provider 配置 panel
- **THEN** the "默认模型" section SHALL NOT be visible

#### Scenario: Model default is unset
- **WHEN** a model default key does not exist in `system_settings`
- **THEN** the UI SHALL display the hardcoded fallback value as a hint (e.g. "使用系统默认值 (doubao-seed-1-6-vision-250815)")
- **AND** for Agent Brain model, the hint SHALL show "跟随默认聊天模型"

#### Scenario: Super-admin saves model default
- **WHEN** a super-admin edits and saves a model default value
- **THEN** the value SHALL be persisted to `system_settings` and take effect on subsequent requests without redeployment
