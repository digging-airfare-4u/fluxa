# Requirements Document

## Introduction

本文档定义 ChatCanvas 微交互与动效系统的需求规范。目标是在不重构现有架构、不新增重型动画依赖的前提下，通过"微动效 + 状态反馈"显著提升 Chat + Canvas 产品的质感与可用性。

### 动效原则（Calm / Soft / Predictable）
- 低幅度、慢节奏、有反馈、可预期
- 避免夸张弹跳、飞入飞出、过度装饰性动画
- 保持最小 diff，不引入新动画库（仅用 Tailwind class / CSS keyframes / Fabric animate）

### 技术约束
- 使用现有 Tailwind CSS 4 + CSS variables
- 使用 CSS keyframes 实现动画
- Canvas 动效使用 Fabric.js 内置 animate 方法
- 不引入 Framer Motion、GSAP 等额外动画库

## Glossary

- **Animation_Token**: 统一的动效参数（duration、easing、scale 等），定义在 CSS variables 中
- **Skeleton**: 内容加载占位符，使用呼吸动画表示加载状态
- **Breathe_Animation**: 轻柔的脉冲动画，用于 Skeleton 和加载状态
- **Focus_Ring**: 输入框聚焦时的外发光效果
- **Hover_Overlay**: 图片卡片悬停时显示的操作浮层
- **Canvas_Landing**: 生成结果落到画布时的入场动效
- **Inline_Error**: 在输入框下方显示的内联错误提示
- **Busy_State**: 生成中的禁用状态，输入框 readOnly + opacity 降低

## Requirements

### Requirement 1: 全局动效 Token 系统

**User Story:** As a developer, I want unified animation tokens, so that all animations are consistent across the application.

#### Acceptance Criteria

1. THE System SHALL define CSS variables for animation tokens in `globals.css`:
   - `--animation-duration-fast`: 180ms
   - `--animation-duration-normal`: 240ms
   - `--animation-duration-slow`: 320ms
   - `--animation-easing`: cubic-bezier(0.22, 1, 0.36, 1)
   - `--animation-scale-in`: 0.96
   - `--animation-hover-scale`: 1.01
2. THE System SHALL define shadow tokens:
   - `--shadow-focus`: 0 0 0 4px rgba(124, 58, 237, 0.1)
   - `--shadow-hover`: 0 8px 32px rgba(0, 0, 0, 0.12)
3. WHEN any component uses animations, THE Component SHALL reference these tokens instead of hardcoded values
4. THE System SHALL support reduced motion preference via `prefers-reduced-motion` media query

### Requirement 2: Chat 输入区动效

**User Story:** As a user, I want smooth visual feedback when interacting with the chat input, so that I know the system is responding to my actions.

#### Acceptance Criteria

1. WHEN the input field receives focus, THE ChatInput SHALL:
   - Apply border brightening transition (180-220ms)
   - Show subtle outer glow using `--shadow-focus`
   - NOT use large shadows that feel heavy
2. WHEN the system is generating (Busy state), THE ChatInput SHALL:
   - Set input to readOnly
   - Apply opacity 0.8 to the entire input area
   - Replace send button text/icon with three-dot loading animation
3. THE ChatInput SHALL display keyboard shortcuts hint:
   - "Shift + Enter 换行"
   - "⌘/Ctrl + Enter 发送"
4. THE ChatInput SHALL use `max-height` with internal scroll to prevent height jitter during typing
5. WHEN transitioning between states, THE ChatInput SHALL use `--animation-duration-fast` timing

### Requirement 3: 按钮系统动效

**User Story:** As a user, I want buttons to provide tactile feedback, so that I know my clicks are registered.

#### Acceptance Criteria

1. WHEN hovering over a primary button (Generate/Send), THE Button SHALL:
   - Increase brightness by 5%
   - Transition over 150ms
2. WHEN clicking a primary button, THE Button SHALL:
   - Scale to 0.98 for 100ms
   - Return to scale 1.0
3. WHEN a button is disabled, THE Button SHALL:
   - Apply opacity 0.5
   - Set pointer-events to none
   - NOT show any hover/active effects
4. WHEN a button is in loading state, THE Button SHALL:
   - Display three-dot loading animation (not spinner)
   - Maintain button dimensions to prevent layout shift
5. WHEN hovering over a secondary button, THE Button SHALL:
   - Apply subtle background fill
   - NOT scale on active (to avoid jumpiness)

### Requirement 4: 生成流程动效（三段式反馈）

**User Story:** As a user, I want clear visual feedback during the generation process, so that I understand what the system is doing.

#### Acceptance Criteria

1. WHEN generation starts (Phase A: 0-150ms), THE System SHALL:
   - Immediately switch button to "Generating..." state
   - Append "正在生成" message to chat list
   - Set input area to Busy state
2. WHEN waiting for generation (Phase B), THE System SHALL:
   - Display Skeleton image placeholder in chat
   - Apply breathe animation to Skeleton (not traditional spinner)
   - Reserve space to prevent layout jump when image arrives
3. WHEN generation completes (Phase C), THE System SHALL:
   - Transition Skeleton to actual image card
   - Apply Scale + Fade In animation (0.96 → 1, opacity 0 → 1)
   - Use `--animation-duration-slow` (260-320ms)
4. THE System SHALL provide a Stop button during generation (secondary button style)
5. WHEN generation fails, THE System SHALL:
   - Display inline error below input (not alert/modal)
   - Use orange-tinted color (not pure red)
   - Provide Retry chip/button

### Requirement 5: 图片卡片动效

**User Story:** As a user, I want generated images to appear smoothly and provide clear interaction affordances.

#### Acceptance Criteria

1. WHEN an image card appears, THE Card SHALL animate with:
   - opacity: 0 → 1
   - scale: 0.96 → 1
   - duration: 260-320ms
   - easing: `--animation-easing`
2. WHEN hovering over an image card, THE Card SHALL:
   - Scale to 1.01
   - Enhance shadow
   - Transition over 200ms
3. WHEN hovering over an image card, THE System SHALL show operation overlay:
   - Appear with 80ms delay (to avoid flicker on quick mouse passes)
   - Position in top-right corner as capsule buttons
   - Animate: opacity 0 → 1, translateY 4px → 0 (120-150ms)
4. THE operation overlay SHALL contain:
   - Download button
   - Copy prompt button
   - Add to canvas button
5. WHEN mouse leaves the image card, THE overlay SHALL fade out over 100ms

### Requirement 6: Canvas 落地动效

**User Story:** As a user, I want generated content to appear naturally on the canvas, so that the experience feels polished.

#### Acceptance Criteria

1. WHEN a generated image/element is added to canvas, THE Element SHALL animate with:
   - Initial state: opacity 0, scale 0.96, origin center
   - Final state: opacity 1, scale 1
   - Duration: 280ms
   - Easing: easeOutCubic
2. THE System MAY apply optional settle effect:
   - top offset: +3px → 0 over 220ms
3. THE animation SHALL be implemented using Fabric.js `animate()` method
4. THE animation SHALL be local-only (not synced via Realtime) to avoid collaboration conflicts
5. WHEN multiple elements are added simultaneously, THE System SHALL stagger animations by 50ms each

### Requirement 7: 空状态与错误状态

**User Story:** As a user, I want helpful guidance when there's no content or when errors occur.

#### Acceptance Criteria

1. WHEN the chat panel is empty, THE System SHALL:
   - Display guidance text (e.g., "描述你想要的设计，AI 将为你生成可编辑的画布")
   - Fade in the text over 400ms
   - NOT leave the area blank
2. WHEN an error occurs, THE System SHALL:
   - Display inline error message 8px below the input
   - Use orange-tinted color (not pure red) for less alarming appearance
   - Include Retry button/chip
   - NOT use alert() or modal dialogs
3. WHEN displaying error messages, THE Message SHALL:
   - Fade in over 200ms
   - Auto-dismiss after 8 seconds (if non-critical)
   - Allow manual dismissal

### Requirement 8: Skeleton 占位符组件

**User Story:** As a user, I want loading placeholders that feel calm and indicate progress.

#### Acceptance Criteria

1. THE Skeleton component SHALL use breathe animation:
   - Opacity oscillation: 0.4 → 1 → 0.4
   - Scale oscillation: 0.9 → 1.05 → 0.9
   - Duration: 3.2s per cycle
   - Easing: ease-in-out
2. THE Skeleton SHALL match the expected content dimensions to prevent layout shift
3. WHEN used for image placeholders, THE Skeleton SHALL:
   - Use rounded corners matching the final image card
   - Display a subtle icon or pattern indicating image content
4. THE Skeleton SHALL respect `prefers-reduced-motion` by using opacity-only animation

### Requirement 9: 快捷键支持

**User Story:** As a power user, I want keyboard shortcuts for common actions.

#### Acceptance Criteria

1. THE System SHALL support the following shortcuts:
   - `⌘/Ctrl + Enter`: Send message / Generate
   - `Shift + Enter`: New line in input
   - `Escape`: Close preview/overlay, cancel current action
2. WHEN a shortcut is triggered, THE System SHALL provide visual feedback:
   - Brief highlight on the triggered element
   - Or button press animation
3. THE shortcuts SHALL be displayed as hints near relevant UI elements
4. THE shortcuts SHALL NOT conflict with browser or OS defaults

### Requirement 10: 减少动画偏好支持

**User Story:** As a user with motion sensitivity, I want the option to reduce animations.

#### Acceptance Criteria

1. WHEN `prefers-reduced-motion: reduce` is set, THE System SHALL:
   - Disable all transform-based animations (scale, translate)
   - Keep opacity transitions but reduce duration to 100ms
   - Disable breathe animation on Skeletons (use static opacity)
   - Disable canvas landing animations
2. THE System SHALL automatically detect the preference via CSS media query
3. ALL animation implementations SHALL include reduced-motion fallbacks

