# Design Document: Micro-Interactions & Animation System

## Overview

This design document specifies the implementation of a cohesive micro-interaction and animation system for ChatCanvas. The system enhances user experience through subtle, predictable animations that provide feedback without overwhelming the interface.

The design follows the "Calm / Soft / Predictable" principle: low amplitude, slow pace, clear feedback, and predictable behavior. All animations use unified tokens and respect user preferences for reduced motion.

## Architecture

### Animation Token System

The animation system is built on CSS custom properties (variables) that define consistent timing, easing, and scale values across all components.

```
┌─────────────────────────────────────────────────────────────┐
│                    globals.css                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Animation Tokens (CSS Variables)                    │    │
│  │  - --animation-duration-fast: 180ms                  │    │
│  │  - --animation-duration-normal: 240ms                │    │
│  │  - --animation-duration-slow: 320ms                  │    │
│  │  - --animation-easing: cubic-bezier(0.22,1,0.36,1)  │    │
│  │  - --animation-scale-in: 0.96                        │    │
│  │  - --animation-hover-scale: 1.01                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Keyframe Animations                                 │    │
│  │  - @keyframes breathe (skeleton pulse)               │    │
│  │  - @keyframes fadeScaleIn (element appearance)       │    │
│  │  - @keyframes dotPulse (loading dots)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Components                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  ChatInput   │  │  Button      │  │  Skeleton    │       │
│  │  (focus,     │  │  (hover,     │  │  (breathe    │       │
│  │   busy)      │  │   active,    │  │   animation) │       │
│  │              │  │   loading)   │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  ImageCard   │  │  ChatMessage │  │  Canvas      │       │
│  │  (appear,    │  │  (appear,    │  │  (landing    │       │
│  │   hover)     │  │   skeleton)  │  │   effect)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### State Machine: Generation Flow

```
┌─────────────┐     User sends      ┌─────────────┐
│    Idle     │ ─────message─────▶  │   Phase A   │
│             │                     │  (0-150ms)  │
└─────────────┘                     └──────┬──────┘
      ▲                                    │
      │                                    ▼
      │                             ┌─────────────┐
      │                             │   Phase B   │
      │                             │  (waiting)  │
      │                             └──────┬──────┘
      │                                    │
      │         ┌──────────────────────────┼──────────────────────────┐
      │         │                          │                          │
      │         ▼                          ▼                          ▼
      │   ┌───────────┐             ┌─────────────┐            ┌───────────┐
      │   │  Success  │             │   Stopped   │            │  Failed   │
      │   │ (Phase C) │             │  (by user)  │            │  (error)  │
      │   └─────┬─────┘             └──────┬──────┘            └─────┬─────┘
      │         │                          │                          │
      └─────────┴──────────────────────────┴──────────────────────────┘
```

## Components and Interfaces

### 1. Animation Token CSS Variables

Location: `src/app/globals.css`

```css
:root {
  /* Animation Timing */
  --animation-duration-fast: 180ms;
  --animation-duration-normal: 240ms;
  --animation-duration-slow: 320ms;
  
  /* Animation Easing */
  --animation-easing: cubic-bezier(0.22, 1, 0.36, 1);
  --animation-easing-out: cubic-bezier(0, 0, 0.2, 1);
  
  /* Animation Scale */
  --animation-scale-in: 0.96;
  --animation-hover-scale: 1.01;
  --animation-active-scale: 0.98;
  
  /* Focus & Shadow */
  --shadow-focus: 0 0 0 4px rgba(124, 58, 237, 0.1);
  --shadow-hover: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

### 2. LoadingDots Component

New component for three-dot loading animation.

```typescript
interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

### 3. Enhanced Skeleton Component

Updated skeleton with breathe animation.

```typescript
interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'image' | 'text';
  animate?: boolean; // respects prefers-reduced-motion
}
```

### 4. ImageCard Component

New component for generated image display with hover overlay.

```typescript
interface ImageCardProps {
  src: string;
  alt?: string;
  onDownload?: () => void;
  onCopyPrompt?: () => void;
  onAddToCanvas?: () => void;
  className?: string;
}
```

### 5. InlineError Component

New component for inline error display.

```typescript
interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number; // default 8000ms
}
```

### 6. Enhanced ChatInput

Updated with focus glow, busy state, and keyboard hints.

```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isBusy?: boolean; // new: generation in progress
  placeholder?: string;
  showKeyboardHints?: boolean; // new
}
```

### 7. Canvas Landing Animation

Extension to OpsExecutor for animated element addition.

```typescript
interface AnimatedAddOptions {
  duration?: number; // default 280ms
  easing?: string; // default 'easeOutCubic'
  staggerDelay?: number; // default 50ms for multiple elements
}
```

## Data Models

### Animation State Types

```typescript
type GenerationPhase = 'idle' | 'phase-a' | 'phase-b' | 'success' | 'failed' | 'stopped';

interface GenerationState {
  phase: GenerationPhase;
  startTime?: number;
  error?: string;
}

interface AnimationConfig {
  duration: number;
  easing: string;
  scale: { from: number; to: number };
  opacity: { from: number; to: number };
}
```

### CSS Keyframe Definitions

```css
@keyframes breathe {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes fadeScaleIn {
  from {
    opacity: 0;
    transform: scale(var(--animation-scale-in));
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dotPulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Animation Token Definition

*For any* animation token defined in the specification (duration-fast, duration-normal, duration-slow, easing, scale-in, hover-scale, shadow-focus, shadow-hover), the CSS variable SHALL exist in globals.css with the specified value.

**Validates: Requirements 1.1, 1.2**

### Property 2: State Transition Styling

*For any* interactive component (ChatInput, Button, ImageCard) undergoing a state transition (focus, hover, active), the component SHALL apply the correct styles within the duration specified by the corresponding animation token.

**Validates: Requirements 2.1, 2.5, 3.1, 3.2, 5.2, 5.5**

### Property 3: Reduced Motion Compliance

*For any* animation in the system, when `prefers-reduced-motion: reduce` is active, transform-based animations (scale, translate) SHALL be disabled, opacity transitions SHALL complete within 100ms, and the Skeleton breathe animation SHALL use opacity-only mode.

**Validates: Requirements 1.4, 8.4, 10.1, 10.3**

### Property 4: Generation Phase Flow

*For any* generation request, the system SHALL transition through phases in order: idle → phase-a (within 150ms) → phase-b (skeleton visible) → success/failed, and each phase SHALL display the correct UI state (button text, skeleton, result/error).

**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

### Property 5: Element Appearance Animation

*For any* newly rendered element (ImageCard, canvas object), the element SHALL animate from opacity 0 and scale 0.96 to opacity 1 and scale 1, with hover overlays appearing only after an 80ms delay.

**Validates: Requirements 5.1, 5.3, 6.1**

### Property 6: Disabled/Loading State Behavior

*For any* component in disabled or loading state, user interaction SHALL be prevented (pointer-events: none or readOnly), visual opacity SHALL be reduced, and loading indicators (three-dot animation) SHALL be displayed when applicable.

**Validates: Requirements 2.2, 3.3, 3.4**

### Property 7: Canvas Animation Stagger

*For any* batch of N elements added to canvas simultaneously, element i SHALL begin its animation at time (i * staggerDelay) milliseconds after the batch operation starts, where staggerDelay defaults to 50ms.

**Validates: Requirements 6.5**

### Property 8: Skeleton Dimension Preservation

*For any* Skeleton placeholder, the rendered dimensions (width, height) SHALL equal the expected content dimensions, ensuring zero layout shift when content replaces the skeleton.

**Validates: Requirements 8.2**

### Property 9: Keyboard Shortcut Functionality

*For any* defined keyboard shortcut (⌘/Ctrl+Enter for send, Shift+Enter for newline, Escape for cancel), pressing the shortcut SHALL trigger the corresponding action and provide visual feedback.

**Validates: Requirements 9.1, 9.2**

### Property 10: Inline Error Display

*For any* error occurrence during generation or other operations, the error message SHALL be displayed inline below the input (not as alert/modal), SHALL use orange-tinted styling, and SHALL include a retry action when the operation is retryable.

**Validates: Requirements 7.2, 7.3**

## Error Handling

### Animation Failures

- If CSS animation fails to apply, fall back to instant state change
- Log animation errors to console in development mode
- Never block user interaction due to animation issues

### Image Loading Errors

- Display error state in ImageCard with retry option
- Maintain skeleton dimensions during error state
- Provide clear error message

### Generation Failures

- Transition to failed state with inline error
- Preserve user's input message
- Enable retry without re-typing

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Animation Token Tests**: Verify CSS variables are correctly defined and accessible
2. **Component State Tests**: Test state transitions (idle → busy → success/failed)
3. **Keyboard Shortcut Tests**: Verify shortcuts trigger correct actions
4. **Reduced Motion Tests**: Verify animations are disabled when preference is set

### Property-Based Tests

Property-based tests verify universal properties across all inputs using fast-check:

1. **Token Consistency Property**: Generate random components and verify they use token values
2. **State Transition Property**: Generate random state sequences and verify valid transitions
3. **Timing Property**: Generate random animation timings and verify they fall within token bounds
4. **Accessibility Property**: Generate random motion preferences and verify compliance

### Integration Tests

1. **Generation Flow Test**: Full flow from message send to canvas update
2. **Animation Sequence Test**: Verify staggered animations execute in order
3. **Error Recovery Test**: Verify retry functionality after failures

### Test Configuration

- Property-based tests: minimum 100 iterations per property
- Use fast-check for property generation
- Tag format: **Feature: micro-interactions, Property {number}: {property_text}**

