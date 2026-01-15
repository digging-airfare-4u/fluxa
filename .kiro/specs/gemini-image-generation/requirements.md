# Requirements Document

## Introduction

集成 Google Gemini 图像生成 API（Nano Banana）到 Fluxa 平台，支持文生图、图生图、多轮对话编辑，并通过会员等级控制可用的图像分辨率（1K/2K/4K）。

## Glossary

- **Gemini_Image_Service**: Gemini 图像生成服务，调用 Google Generative AI API
- **Image_Resolution**: 图像分辨率等级，包括 1K、2K、4K
- **Multi_Turn_Chat**: 多轮对话编辑，通过 chat session 持续迭代修改图像
- **Membership_Level**: 会员等级（free/pro/team）
- **Resolution_Permission**: 会员等级对应的最大可用分辨率权限
- **Aspect_Ratio**: 图像宽高比（1:1, 16:9, 9:16, 4:3, 3:4 等）
- **Reference_Image**: 图生图时提供的参考图像
- **Chat_Session**: Gemini 多轮对话会话，用于持续编辑同一图像

## Requirements

### Requirement 1: Gemini 图像生成基础能力

**User Story:** As a user, I want to generate images using Gemini AI models, so that I can create high-quality visuals with better text rendering and style control.

#### Acceptance Criteria

1. THE Gemini_Image_Service SHALL support `gemini-2.5-flash-image` model for fast image generation
2. THE Gemini_Image_Service SHALL support `gemini-3-pro-image-preview` model for professional 4K output
3. WHEN a user provides a text prompt, THE Gemini_Image_Service SHALL generate an image matching the description
4. WHEN a user provides a reference image with prompt, THE Gemini_Image_Service SHALL perform image-to-image editing
5. THE System SHALL store generated images in Supabase Storage and create asset records
6. THE System SHALL create addImage ops to display generated images on canvas
7. THE System SHALL enqueue image generation via the existing jobs table and process asynchronously through Supabase Edge Functions
8. WHEN a reference image is provided, THE System SHALL validate ownership or a signed URL before passing it to Gemini


### Requirement 2: 多轮对话图像编辑

**User Story:** As a user, I want to iteratively edit generated images through conversation, so that I can refine the output without starting from scratch.

#### Acceptance Criteria

1. THE System SHALL maintain a Gemini chat session per conversation for multi-turn editing
2. WHEN a user sends a follow-up message in the same conversation, THE System SHALL use the existing chat session to preserve context
3. WHEN editing an existing image, THE System SHALL pass the previous image as context to Gemini
4. THE System SHALL support commands like "change the background to blue" or "add a hat to the character"
5. WHEN a new conversation starts, THE System SHALL create a fresh chat session
6. THE System SHALL store chat session state to enable continuation across requests
7. THE chat session state SHALL reference stored assets (asset_id/storage_path) instead of persisting raw base64 image data

### Requirement 3: 会员分辨率权限控制

**User Story:** As a platform operator, I want to control image resolution based on membership level, so that premium features drive upgrade conversions.

#### Acceptance Criteria

1. THE membership_configs.perks SHALL include `max_image_resolution` field with values: "1K", "2K", or "4K"
2. WHEN a free user requests image generation, THE System SHALL limit resolution to 1K
3. WHEN a pro user requests image generation, THE System SHALL allow resolution up to 2K
4. WHEN a team user requests image generation, THE System SHALL allow resolution up to 4K
5. IF a user requests resolution exceeding their permission, THE System SHALL return an error with upgrade suggestion
6. THE Frontend SHALL display available resolution options based on user's membership level
7. THE Frontend SHALL show locked/disabled state for resolutions above user's permission
8. THE System SHALL map resolution presets to concrete pixel targets (1K~1024px max dimension, 2K~2048px, 4K~4096px) and reject unsupported model/resolution combinations

### Requirement 4: 宽高比支持

**User Story:** As a user, I want to choose different aspect ratios for generated images, so that I can create content for various platforms (Instagram, YouTube, etc.).

#### Acceptance Criteria

1. THE Gemini_Image_Service SHALL support aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 4:5, 5:4, 21:9
2. WHEN a user selects an aspect ratio, THE System SHALL pass it to Gemini API via imageConfig
3. THE Frontend SHALL provide aspect ratio selector with common presets
4. THE System SHALL default to 1:1 aspect ratio if not specified


### Requirement 5: 点数消耗与计费

**User Story:** As a user, I want to understand the points cost before generating images, so that I can manage my balance effectively.

#### Acceptance Criteria

1. THE ai_models table SHALL include Gemini image models with appropriate points_cost
2. WHEN generating with gemini-2.5-flash-image, THE System SHALL deduct configured points (default: 25)
3. WHEN generating with gemini-3-pro-image-preview at 1K, THE System SHALL deduct base points (default: 40)
4. WHEN generating with gemini-3-pro-image-preview at 2K, THE System SHALL deduct 1.5x base points
5. WHEN generating with gemini-3-pro-image-preview at 4K, THE System SHALL deduct 2x base points
6. THE System SHALL check points balance before generation and return INSUFFICIENT_POINTS error if needed
7. THE Frontend SHALL display points cost before user confirms generation
8. THE System SHALL reuse the existing deduct_points RPC (or equivalent transaction) to ensure atomic point deduction with generation jobs

### Requirement 6: 前端模型列表与选择

**User Story:** As a user, I want to see and select Nano Banana (Gemini) models in the image generation UI, so that I can choose the best model for my needs.

#### Acceptance Criteria

1. THE Frontend SHALL fetch available image models from ai_models table on load
2. THE ai_models table SHALL include `gemini-3-pro-image-preview` with display_name "Nano Banana Pro"
3. THE Frontend SHALL display Nano Banana Pro model in the model selector dropdown
4. WHEN user selects Nano Banana Pro, THE System SHALL use gemini-3-pro-image-preview for generation
5. THE Frontend SHALL show model description and points cost for each available model
6. THE ai_models entries SHALL include provider field to distinguish Gemini from other providers

### Requirement 7: 数据库与配置

**User Story:** As a developer, I want proper database schema to support Gemini integration, so that the system is maintainable and extensible.

#### Acceptance Criteria

1. THE ai_models table SHALL include entries for gemini-2.5-flash-image and gemini-3-pro-image-preview
2. THE membership_configs.perks SHALL be updated to include max_image_resolution for each level
3. THE jobs table input JSONB SHALL support storing chat_session_id for multi-turn context
4. THE System SHALL store Gemini API key in Supabase Edge Function secrets as GEMINI_API_KEY
5. THE system_settings table SHALL store Gemini API host with key `gemini_api_host`
6. THE gemini_api_host setting SHALL default to `https://generativelanguage.googleapis.com` if not configured
7. THE System SHALL query system_settings to get API host and construct URL as `${host}/v1beta/models/${model}:generateContent`
8. THE system_settings table SHALL be publicly readable for Edge Functions to access configuration
9. THE chat_sessions table SHALL apply RLS to enforce per-user access to their conversations and assets
