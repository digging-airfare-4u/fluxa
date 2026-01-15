# Requirements Document

## Introduction

本文档定义了 Fluxa 项目国际化（i18n）功能的需求规范。目标是在不破坏现有功能的前提下，将界面文案、提示、错误信息、按钮文本等全部从硬编码改为 i18n 可配置，支持至少 zh-CN 与 en-US 两种语言，并提供可扩展到更多语言的工程化方案。

## Glossary

- **I18n_System**: 国际化系统，负责管理多语言资源、语言切换和文案渲染
- **Translation_Key**: 翻译键，用于标识特定文案的唯一标识符，遵循 `domain.section.component.action` 命名规范
- **Locale**: 语言区域标识，如 `zh-CN`（简体中文）、`en-US`（美式英语）
- **Namespace**: 命名空间，按业务域拆分的资源文件分组
- **Fallback**: 回退机制，当翻译缺失时的降级处理策略
- **Interpolation**: 变量插值，在翻译文案中嵌入动态变量的机制

## Requirements

### Requirement 1: i18n 库集成与配置

**User Story:** As a developer, I want to integrate a mature i18n library into the Next.js project, so that I can manage translations efficiently with SSR/CSR compatibility.

#### Acceptance Criteria

1. THE I18n_System SHALL use `next-intl` library for Next.js App Router integration
2. THE I18n_System SHALL support SSR rendering with correct initial locale without hydration mismatch
3. THE I18n_System SHALL support CSR dynamic language switching without full page refresh
4. WHEN the application loads, THE I18n_System SHALL detect user's preferred locale from browser settings or stored preference
5. THE I18n_System SHALL persist user's language preference to localStorage
6. THE I18n_System SHALL provide a `useTranslations` hook for accessing translations in client components
7. THE I18n_System SHALL provide server-side translation functions for server components

### Requirement 2: 翻译资源文件结构

**User Story:** As a developer, I want translation resources organized by namespace, so that I can maintain and scale translations efficiently.

#### Acceptance Criteria

1. THE I18n_System SHALL organize translation files in `src/locales/{locale}/{namespace}.json` structure
2. THE I18n_System SHALL support the following namespaces: `common`, `auth`, `editor`, `chat`, `home`, `points`, `errors`
3. THE I18n_System SHALL use alphabetically sorted keys within each namespace file
4. WHEN a Translation_Key is missing in the current locale, THE I18n_System SHALL fallback to `en-US` locale
5. IF a Translation_Key is missing in all locales, THEN THE I18n_System SHALL display `__MISSING_KEY__:{key}` for debugging
6. THE I18n_System SHALL support nested key structures up to 3 levels deep

### Requirement 3: Translation_Key 命名规范

**User Story:** As a developer, I want consistent key naming conventions, so that translations are maintainable and searchable.

#### Acceptance Criteria

1. THE Translation_Key SHALL follow the pattern `{namespace}.{section}.{element}` or `{namespace}.{section}.{element}.{action}`
2. THE Translation_Key SHALL use lowercase letters, numbers, and underscores only
3. THE Translation_Key SHALL NOT use Chinese characters as keys
4. WHEN creating new keys, THE I18n_System documentation SHALL provide examples for each namespace
5. THE Translation_Key SHALL be unique across the entire application

### Requirement 4: 变量插值支持

**User Story:** As a developer, I want to use dynamic variables in translations, so that I can create contextual messages.

#### Acceptance Criteria

1. THE I18n_System SHALL support variable interpolation using `{variableName}` syntax
2. THE I18n_System SHALL support rich text formatting with HTML tags in translations
3. WHEN a variable is missing during interpolation, THE I18n_System SHALL display the variable placeholder as-is
4. THE I18n_System SHALL support date/time formatting using `Intl.DateTimeFormat`
5. THE I18n_System SHALL support number formatting using `Intl.NumberFormat`
6. THE I18n_System SHALL support currency formatting for points display

### Requirement 5: 复数规则支持

**User Story:** As a developer, I want proper plural handling for different languages, so that grammar is correct in all locales.

#### Acceptance Criteria

1. THE I18n_System SHALL support ICU plural syntax for English (`one`, `other`)
2. THE I18n_System SHALL support Chinese plural forms (typically no plural distinction)
3. WHEN displaying counts, THE I18n_System SHALL use the correct plural form based on the count value
4. THE I18n_System SHALL support ordinal numbers where applicable

### Requirement 6: 语言切换功能

**User Story:** As a user, I want to switch the interface language, so that I can use the application in my preferred language.

#### Acceptance Criteria

1. THE I18n_System SHALL provide a language selector component in the user profile area
2. WHEN a user selects a new language, THE I18n_System SHALL update the interface immediately without full page reload
3. THE I18n_System SHALL persist the selected language preference
4. WHEN a user returns to the application, THE I18n_System SHALL restore their previously selected language
5. THE I18n_System SHALL update the HTML `lang` attribute when language changes

### Requirement 7: 页面标题与导航文案

**User Story:** As a user, I want all navigation elements in my preferred language, so that I can navigate the application easily.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all page titles in browser tab
2. THE I18n_System SHALL translate all navigation menu items
3. THE I18n_System SHALL translate all breadcrumb labels
4. THE I18n_System SHALL translate all tab labels
5. THE I18n_System SHALL translate all button text
6. THE I18n_System SHALL translate all tooltip content

### Requirement 8: 表单与输入文案

**User Story:** As a user, I want form elements in my preferred language, so that I can understand input requirements.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all form labels
2. THE I18n_System SHALL translate all input placeholders
3. THE I18n_System SHALL translate all validation error messages
4. THE I18n_System SHALL translate all helper text
5. WHEN form validation fails, THE I18n_System SHALL display localized error messages

### Requirement 9: 反馈与通知文案

**User Story:** As a user, I want system feedback in my preferred language, so that I can understand application status.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all toast/notification messages
2. THE I18n_System SHALL translate all modal/dialog content including titles, body text, and buttons
3. THE I18n_System SHALL translate all confirmation dialog text
4. THE I18n_System SHALL translate all loading state messages
5. THE I18n_System SHALL translate all success/error feedback messages

### Requirement 10: 状态与空态文案

**User Story:** As a user, I want status messages in my preferred language, so that I can understand the current state.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all empty state messages
2. THE I18n_System SHALL translate all loading indicators text
3. THE I18n_System SHALL translate all "no permission" messages
4. THE I18n_System SHALL translate 404 and 500 error page content
5. THE I18n_System SHALL translate all "no data" messages

### Requirement 11: 错误处理文案

**User Story:** As a user, I want error messages in my preferred language, so that I can understand and resolve issues.

#### Acceptance Criteria

1. THE I18n_System SHALL provide a mapping from API error codes to localized messages
2. THE I18n_System SHALL translate all client-side error messages
3. THE I18n_System SHALL translate all network error messages
4. THE I18n_System SHALL translate all timeout messages
5. WHEN an unknown error occurs, THE I18n_System SHALL display a generic localized error message

### Requirement 12: 系统操作提示

**User Story:** As a user, I want operation feedback in my preferred language, so that I can confirm my actions.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all upload progress/status messages
2. THE I18n_System SHALL translate all export progress/status messages
3. THE I18n_System SHALL translate all copy-to-clipboard feedback
4. THE I18n_System SHALL translate all save/auto-save status messages

### Requirement 13: 无障碍文案

**User Story:** As a user with accessibility needs, I want accessible labels in my preferred language, so that I can use assistive technologies effectively.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all `aria-label` attributes
2. THE I18n_System SHALL translate all `alt` text for images
3. THE I18n_System SHALL translate all `title` attributes
4. THE I18n_System SHALL ensure screen readers announce content in the correct language

### Requirement 14: 编辑器特定文案

**User Story:** As a user, I want the design editor interface in my preferred language, so that I can use all editing features.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all toolbar labels and tooltips
2. THE I18n_System SHALL translate all context menu items
3. THE I18n_System SHALL translate all layer panel labels
4. THE I18n_System SHALL translate all property panel labels
5. THE I18n_System SHALL translate all keyboard shortcut descriptions

### Requirement 15: 聊天面板文案

**User Story:** As a user, I want the chat interface in my preferred language, so that I can interact with AI effectively.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all chat panel UI elements
2. THE I18n_System SHALL translate all AI generation status messages
3. THE I18n_System SHALL translate all chat input placeholders
4. THE I18n_System SHALL translate all model selector labels
5. THE I18n_System SHALL translate all error messages in chat context

### Requirement 16: 积分系统文案

**User Story:** As a user, I want points-related information in my preferred language, so that I can understand my usage and balance.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all points balance display
2. THE I18n_System SHALL translate all transaction history labels
3. THE I18n_System SHALL translate all insufficient points dialog content
4. THE I18n_System SHALL translate all pricing page content
5. THE I18n_System SHALL translate all membership tier descriptions
