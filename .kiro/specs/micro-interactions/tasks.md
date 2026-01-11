# Implementation Plan: Micro-Interactions & Animation System

## Overview

This implementation plan adds a cohesive micro-interaction and animation system to ChatCanvas. The approach prioritizes minimal changes to existing components, using CSS variables and keyframes rather than new animation libraries. Implementation follows the order: tokens → base components → chat components → canvas integration.

## Tasks

- [x] 1. Add animation tokens and keyframes to globals.css
  - Define CSS variables for animation timing, easing, scale, and shadow
  - Add keyframe animations: breathe, fadeScaleIn, dotPulse
  - Add reduced-motion media query overrides
  - _Requirements: 1.1, 1.2, 1.4, 10.1, 10.2, 10.3_

- [x] 2. Create LoadingDots component
  - [x] 2.1 Implement LoadingDots component with three-dot animation
    - Create `src/components/ui/LoadingDots.tsx`
    - Support size variants (sm, md, lg)
    - Use dotPulse keyframe animation with staggered delays
    - _Requirements: 3.4_
  - [ ]* 2.2 Write property test for LoadingDots reduced motion compliance
    - **Property 3: Reduced Motion Compliance**
    - **Validates: Requirements 1.4, 10.1**

- [x] 3. Enhance Skeleton component with breathe animation
  - [x] 3.1 Update Skeleton component with breathe animation
    - Replace animate-pulse with custom breathe animation
    - Add variant prop for 'default', 'image', 'text'
    - Add animate prop that respects prefers-reduced-motion
    - _Requirements: 8.1, 8.3, 8.4_
  - [ ]* 3.2 Write property test for Skeleton dimension preservation
    - **Property 8: Skeleton Dimension Preservation**
    - **Validates: Requirements 8.2**

- [x] 4. Create InlineError component
  - [x] 4.1 Implement InlineError component
    - Create `src/components/ui/InlineError.tsx`
    - Orange-tinted styling (not pure red)
    - Include retry button/chip
    - Support auto-dismiss with configurable delay
    - Fade-in animation on mount
    - _Requirements: 7.2, 7.3_
  - [ ]* 4.2 Write property test for inline error display
    - **Property 10: Inline Error Display**
    - **Validates: Requirements 7.2, 7.3**

- [x] 5. Checkpoint - Ensure base components work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Enhance ChatInput with focus glow and busy state
  - [x] 6.1 Add focus glow effect to ChatInput
    - Apply border brightening on focus (180-220ms transition)
    - Add subtle outer glow using shadow-focus token
    - Use max-height with internal scroll to prevent jitter
    - _Requirements: 2.1, 2.4_
  - [x] 6.2 Implement busy state for ChatInput
    - Add isBusy prop to ChatInput interface
    - Set input to readOnly when busy
    - Apply opacity 0.8 to input area
    - Replace send button with LoadingDots when loading
    - _Requirements: 2.2, 2.3_
  - [x] 6.3 Add keyboard shortcut hints to ChatInput
    - Display "Shift + Enter 换行" hint
    - Display "⌘/Ctrl + Enter 发送" hint
    - _Requirements: 2.3, 9.3_
  - [ ]* 6.4 Write property test for ChatInput state transitions
    - **Property 2: State Transition Styling**
    - **Property 6: Disabled/Loading State Behavior**
    - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 7. Enhance Button component with micro-interactions
  - [x] 7.1 Add hover and active animations to Button
    - Primary button: brightness +5% on hover, scale 0.98 on active
    - Secondary button: subtle background fill on hover
    - Ensure disabled state has opacity 0.5 and no hover effects
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  - [x] 7.2 Add loading state with LoadingDots to Button
    - Add isLoading prop to Button
    - Display LoadingDots instead of children when loading
    - Maintain button dimensions during loading
    - _Requirements: 3.4_
  - [ ]* 7.3 Write property test for Button state transitions
    - **Property 2: State Transition Styling**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 8. Checkpoint - Ensure chat input and button work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create ImageCard component with hover overlay
  - [x] 9.1 Implement ImageCard component with appearance animation
    - Create `src/components/chat/ImageCard.tsx`
    - Apply fadeScaleIn animation on mount (opacity 0→1, scale 0.96→1)
    - Duration: 260-320ms with animation-easing
    - _Requirements: 5.1_
  - [x] 9.2 Add hover effects to ImageCard
    - Scale to 1.01 on hover
    - Enhance shadow on hover
    - Transition over 200ms
    - _Requirements: 5.2_
  - [x] 9.3 Implement hover overlay with delayed appearance
    - Show operation buttons (Download, Copy prompt, Add to canvas)
    - Delay overlay appearance by 80ms to prevent flicker
    - Animate: opacity 0→1, translateY 4px→0 (120-150ms)
    - Fade out over 100ms on mouse leave
    - _Requirements: 5.3, 5.4, 5.5_
  - [ ]* 9.4 Write property test for ImageCard appearance and hover
    - **Property 5: Element Appearance Animation**
    - **Validates: Requirements 5.1, 5.3**

- [x] 10. Update ChatPanel with generation flow animations
  - [x] 10.1 Add Skeleton placeholder during generation
    - Display Skeleton with breathe animation during Phase B
    - Match expected image dimensions to prevent layout shift
    - _Requirements: 4.2, 8.2_
  - [x] 10.2 Implement three-phase generation feedback
    - Phase A (0-150ms): Switch button to "Generating...", add pending message
    - Phase B: Show Skeleton placeholder
    - Phase C: Transition to ImageCard with fadeScaleIn
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 10.3 Add Stop button and error handling
    - Show Stop button during generation (secondary style)
    - Display InlineError on failure with Retry option
    - _Requirements: 4.4, 4.5_
  - [ ]* 10.4 Write property test for generation phase flow
    - **Property 4: Generation Phase Flow**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

- [x] 11. Update ChatMessage to use ImageCard
  - Replace inline image rendering with ImageCard component
  - Ensure metadata.imageUrl triggers ImageCard display
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 12. Checkpoint - Ensure chat panel animations work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add canvas landing animation to OpsExecutor
  - [x] 13.1 Implement animated element addition
    - Add animateElement method to OpsExecutor
    - Use Fabric.js animate() for opacity 0→1, scale 0.96→1
    - Duration: 280ms, easing: easeOutCubic
    - _Requirements: 6.1, 6.3_
  - [x] 13.2 Implement staggered animation for batch additions
    - Stagger animations by 50ms for multiple elements
    - Ensure animation is local-only (not synced via Realtime)
    - _Requirements: 6.4, 6.5_
  - [ ]* 13.3 Write property test for canvas animation stagger
    - **Property 7: Canvas Animation Stagger**
    - **Validates: Requirements 6.5**

- [x] 14. Add keyboard shortcut support
  - [x] 14.1 Implement keyboard shortcuts in ChatInput
    - ⌘/Ctrl + Enter: Send message
    - Shift + Enter: New line
    - Escape: Cancel/close
    - _Requirements: 9.1_
  - [x] 14.2 Add visual feedback for shortcut triggers
    - Brief highlight or button press animation on trigger
    - _Requirements: 9.2_
  - [ ]* 14.3 Write property test for keyboard shortcuts
    - **Property 9: Keyboard Shortcut Functionality**
    - **Validates: Requirements 9.1, 9.2**

- [x] 15. Update empty state with guidance and animation
  - Add guidance text to empty ChatPanel
  - Apply 400ms fade-in animation
  - _Requirements: 7.1_

- [x] 16. Final checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify reduced motion preference works across all components
  - Test full generation flow with animations

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All animations use unified tokens from globals.css
- No new animation libraries are introduced (CSS keyframes + Fabric.js animate only)

