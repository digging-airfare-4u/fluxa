# Requirements Document

## Introduction

本文档定义了 Fluxa 画布编辑器中图片浮动工具栏（Image Toolbar）功能的需求。当用户在画布上选中图片元素时，将在图片上方显示一个浮动工具栏，提供图片编辑、AI 增强和导出等功能。该功能参考了主流设计工具的交互模式，旨在提升用户编辑图片的效率。

## Glossary

- **Image_Toolbar**: 图片浮动工具栏，当用户选中画布上的图片时显示的浮动 UI 组件
- **Canvas**: Fabric.js 驱动的无限画布组件
- **Selected_Image**: 当前被用户选中的图片对象（Fabric.js Image 实例）
- **Tool_Action**: 工具栏中的单个操作按钮及其关联的功能
- **AI_Service**: 后端 AI 处理服务，通过 Supabase Edge Function 提供
- **Loading_State**: 异步操作（如 AI 处理）进行中的状态指示
- **Viewport_Transform**: 画布的视口变换矩阵，用于计算屏幕坐标

## Requirements

### Requirement 1: 工具栏显示与定位

**User Story:** As a user, I want to see a floating toolbar when I select an image on the canvas, so that I can quickly access image editing tools.

#### Acceptance Criteria

1. WHEN a user selects an image object on the canvas, THE Image_Toolbar SHALL appear above the selected image
2. WHEN a user selects a non-image object (text, rectangle, path), THE Image_Toolbar SHALL NOT appear
3. WHEN a user deselects the image (clicks elsewhere or presses Escape), THE Image_Toolbar SHALL disappear
4. WHILE the user is moving or scaling the selected image, THE Image_Toolbar SHALL update its position to follow the image
5. WHEN the image is near the top edge of the viewport, THE Image_Toolbar SHALL reposition below the image to remain visible
6. THE Image_Toolbar SHALL be horizontally centered relative to the selected image
7. WHEN multiple images are selected, THE Image_Toolbar SHALL NOT appear (single selection only)

### Requirement 2: 工具栏基础布局

**User Story:** As a user, I want the toolbar to have a clean and organized layout, so that I can easily find and use the tools I need.

#### Acceptance Criteria

1. THE Image_Toolbar SHALL display tool buttons in a horizontal row
2. THE Image_Toolbar SHALL use visual separators between logical groups of tools
3. THE Image_Toolbar SHALL support both icon-only and icon-with-label display modes
4. WHEN a tool has a "New" badge, THE Image_Toolbar SHALL display the badge next to the tool icon
5. THE Image_Toolbar SHALL adapt to the current theme (light/dark mode)
6. THE Image_Toolbar SHALL have a subtle shadow and border for visual separation from the canvas

### Requirement 3: 图片下载功能

**User Story:** As a user, I want to download the selected image, so that I can save it to my device.

#### Acceptance Criteria

1. WHEN a user clicks the download button, THE Image_Toolbar SHALL export the selected image as a PNG file
2. WHEN exporting, THE Image_Toolbar SHALL use the original image resolution (not scaled by canvas zoom)
3. WHEN the download completes, THE Image_Toolbar SHALL trigger a browser download with a generated filename
4. IF the image export fails, THEN THE Image_Toolbar SHALL display an error notification

### Requirement 4: 图片复制功能

**User Story:** As a user, I want to copy the selected image, so that I can paste it elsewhere on the canvas.

#### Acceptance Criteria

1. WHEN a user clicks the copy button in the more menu, THE Image_Toolbar SHALL copy the selected image to the internal clipboard
2. WHEN the copy succeeds, THE Image_Toolbar SHALL display a brief success feedback
3. THE copied image SHALL be available for pasting via keyboard shortcut (Cmd/Ctrl+V) or context menu

### Requirement 5: 图片删除功能

**User Story:** As a user, I want to delete the selected image, so that I can remove unwanted images from my design.

#### Acceptance Criteria

1. WHEN a user clicks the delete button in the more menu, THE Image_Toolbar SHALL remove the selected image from the canvas
2. WHEN the image is deleted, THE Image_Toolbar SHALL disappear
3. THE deletion SHALL be recorded in the undo history for recovery

### Requirement 6: AI 背景移除功能

**User Story:** As a user, I want to remove the background from an image, so that I can isolate the subject for use in my design.

#### Acceptance Criteria

1. WHEN a user clicks the remove background button, THE Image_Toolbar SHALL send the image to the AI_Service for processing
2. WHILE the AI_Service is processing, THE Image_Toolbar SHALL display a loading indicator on the button
3. WHEN the AI_Service returns the processed image, THE Image_Toolbar SHALL replace the original image with the background-removed version
4. IF the AI_Service fails, THEN THE Image_Toolbar SHALL display an error message and restore the original image
5. THE background removal operation SHALL be recorded in the undo history
6. WHEN the user lacks sufficient points, THE Image_Toolbar SHALL display a points insufficient message

### Requirement 7: AI 图片放大功能

**User Story:** As a user, I want to upscale a low-resolution image, so that I can use it at larger sizes without quality loss.

#### Acceptance Criteria

1. WHEN a user clicks the upscale button, THE Image_Toolbar SHALL send the image to the AI_Service for upscaling
2. WHILE the AI_Service is processing, THE Image_Toolbar SHALL display a loading indicator
3. WHEN the AI_Service returns the upscaled image, THE Image_Toolbar SHALL replace the original image with the higher resolution version
4. THE upscaled image SHALL maintain the same position and visual size on the canvas
5. IF the AI_Service fails, THEN THE Image_Toolbar SHALL display an error message
6. WHEN the user lacks sufficient points, THE Image_Toolbar SHALL display a points insufficient message

### Requirement 8: AI 智能擦除功能

**User Story:** As a user, I want to erase unwanted objects from an image, so that I can clean up my images without external tools.

#### Acceptance Criteria

1. WHEN a user clicks the erase button, THE Image_Toolbar SHALL enter erase mode
2. WHILE in erase mode, THE Canvas SHALL display a brush cursor for painting the area to erase
3. WHEN the user finishes painting and confirms, THE Image_Toolbar SHALL send the image and mask to the AI_Service
4. WHILE the AI_Service is processing, THE Image_Toolbar SHALL display a loading indicator
5. WHEN the AI_Service returns the inpainted image, THE Image_Toolbar SHALL replace the original image
6. IF the user cancels erase mode, THEN THE Image_Toolbar SHALL discard the mask and restore normal selection mode
7. WHEN the user lacks sufficient points, THE Image_Toolbar SHALL display a points insufficient message

### Requirement 9: AI 图片扩展功能

**User Story:** As a user, I want to extend an image beyond its original boundaries, so that I can create more canvas space with AI-generated content.

#### Acceptance Criteria

1. WHEN a user clicks the expand button, THE Image_Toolbar SHALL display expansion direction options (top, bottom, left, right, or custom)
2. WHEN the user selects an expansion direction, THE Image_Toolbar SHALL show a preview of the expanded area
3. WHEN the user confirms the expansion, THE Image_Toolbar SHALL send the image and expansion parameters to the AI_Service
4. WHILE the AI_Service is processing, THE Image_Toolbar SHALL display a loading indicator
5. WHEN the AI_Service returns the expanded image, THE Image_Toolbar SHALL replace the original image with the expanded version
6. IF the AI_Service fails, THEN THE Image_Toolbar SHALL display an error message
7. WHEN the user lacks sufficient points, THE Image_Toolbar SHALL display a points insufficient message

### Requirement 10: 更多操作菜单

**User Story:** As a user, I want access to additional image operations through a menu, so that the toolbar remains uncluttered while still providing full functionality.

#### Acceptance Criteria

1. WHEN a user clicks the more button, THE Image_Toolbar SHALL display a dropdown menu with additional options
2. THE more menu SHALL include: copy, delete, bring to front, send to back, lock/unlock
3. WHEN a user clicks outside the menu, THE Image_Toolbar SHALL close the dropdown
4. WHEN a user selects a menu item, THE Image_Toolbar SHALL execute the action and close the menu

### Requirement 11: 国际化支持

**User Story:** As a user, I want the toolbar to display in my preferred language, so that I can understand all the tool labels and messages.

#### Acceptance Criteria

1. THE Image_Toolbar SHALL use the i18n system for all visible text
2. THE Image_Toolbar SHALL translate all aria-label attributes for accessibility
3. THE Image_Toolbar SHALL support at least Chinese (zh-CN) and English (en) languages

### Requirement 12: 键盘快捷键

**User Story:** As a user, I want to use keyboard shortcuts for common image operations, so that I can work more efficiently.

#### Acceptance Criteria

1. WHEN an image is selected and user presses Delete/Backspace, THE Canvas SHALL delete the selected image
2. WHEN an image is selected and user presses Cmd/Ctrl+C, THE Canvas SHALL copy the selected image
3. WHEN an image is selected and user presses Cmd/Ctrl+D, THE Canvas SHALL duplicate the selected image
4. THE keyboard shortcuts SHALL NOT conflict with existing canvas shortcuts

### Requirement 13: 响应式与可访问性

**User Story:** As a user with accessibility needs, I want the toolbar to be fully accessible, so that I can use it with assistive technologies.

#### Acceptance Criteria

1. THE Image_Toolbar SHALL be navigable via keyboard (Tab to move between buttons)
2. THE Image_Toolbar SHALL provide appropriate ARIA labels for all interactive elements
3. THE Image_Toolbar SHALL maintain sufficient color contrast in both light and dark themes
4. WHEN a tool is disabled, THE Image_Toolbar SHALL visually indicate the disabled state and set aria-disabled
