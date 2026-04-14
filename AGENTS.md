# AGENTS.md

This guide is for agentic coding assistants working in the Fluxa repository.

## Project Snapshot (Quick)

- Product: AI-powered design generation platform with chat-driven canvas editing
- Frontend stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Fabric.js 7
- Backend stack: Supabase (Postgres/Auth/Realtime/Storage/Edge Functions), Zustand for client state
- Core flow: User prompt -> `src/app/api/*` route -> Supabase Edge Function -> ops/image output -> canvas execution + realtime sync
- Main editor route: `src/app/app/p/[projectId]/page.tsx`
- Key execution modules:
  - `src/lib/canvas/opsExecutor.ts` (op execution and animation)
  - `src/lib/realtime/subscribeOps.ts` (ops realtime subscription + deduplication)
  - `src/hooks/chat/useGeneration.ts` (generation lifecycle and placeholders)
  - `supabase/functions/generate-ops/index.ts` and `supabase/functions/generate-image/index.ts` (AI generation backend)
- Runtime requirement: Node.js >= 18.12 (recommended 20+) and pnpm 10+

### Current Repository Notes (as checked on 2026-02-13)

- Baseline Vitest tests now exist under `tests/` and should be expanded for core flows.
- Model Config Settings feature (BYOK) is fully implemented with encryption, allowlist validation, and multi-config support (2026-02-28).

## Commands

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Testing
pnpm test           # Run all tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with coverage report

# Run a single test file
pnpm test path/to/test.test.ts

# Run tests matching a pattern
pnpm test -- pattern
```

## High-Level Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Fabric.js 7
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions/Deno)
- **State**: Zustand for client state; Supabase Realtime for live sync
- **Main editor route**: `src/app/app/p/[projectId]/page.tsx`

### Canvas System: Ops-Driven Architecture

All canvas changes are represented as **discrete, replayable ops**. The canvas has three coordinated layers:

1. **`src/lib/canvas/ops.types.ts`** — Op schema (`addImage`, `addText`, `addRect`, `updateLayer`, `removeLayer`, `setBackground`, `setLayerVisibility`, `setLayerLock`, `renameLayer`).
2. **`src/lib/canvas/opsExecutor.ts`** — `OpsExecutor` class that takes an array of ops and mutates the Fabric.js canvas. Handles animation (`fadeIn`, landing scale effects) and idempotency via `seq` keys.
3. **`src/lib/canvas/canvasSynchronizer.ts`** — Bidirectional sync between Fabric.js canvas events and the Zustand Layer Store. Suppresses circular updates via `isUpdating` flag.
4. **`src/lib/store/useLayerStore.ts`** — Source of truth for layer visibility, lock, selection, and naming. Persists structural ops to the database.

**Execution flow**: AI returns ops → `useOpsExecution.ts` calls `OpsExecutor.execute()` → canvas updates. During initial document load, ops are replayed from the database and synchronizer updates are suppressed to avoid duplicate layer creation.

### AI Generation Flow

Three Edge Functions handle generation:

- **`supabase/functions/generate-ops/index.ts`** — Chat/ops generation. Deducts points, calls LLM via `callChatProviderJson()`, validates JSON ops schema, writes ops to DB, returns `{ plan, ops }`.
- **`supabase/functions/generate-image/index.ts`** — Async image generation. Creates a job record, calls image provider, uploads asset, returns `{ jobId }`. Client subscribes to job status via Realtime.
- **`supabase/functions/agent/index.ts`** — SSE-streaming Agent. Uses a planner/executor loop with tool calling (`web_search`, `fetch_url`, `image_search`, `generate_image`). Streams events to the client; persists final message and agent history.

**Client-side generation lifecycle** is managed by `src/hooks/chat/useGeneration.ts`:
- `startImageGeneration()` — Adds placeholder on canvas, calls `generate-image`, subscribes to job, replaces placeholder with actual image op on completion.
- `startOpsGeneration()` — Direct synchronous call to `generate-ops`.
- `startAgentGeneration()` — SSE stream via `generateAgentStream()`, handles `tool_start`/`tool_result` events for inline image placeholders.

**Points behavior**: System models deduct points before generation. If generation fails (provider error, AI error, or Agent crash), points are refunded via `PointsService.refundPoints()` which updates `user_profiles` and records an `adjust` transaction. BYOK models skip points entirely.

### Model Selection System

- **`src/lib/models/resolve-selectable-models.ts`** — Merges system `ai_models` table rows with user-configured provider configs into a unified `SelectableModel[]`.
- System models use `model.name` as value; BYOK models use `user:{configId}`.
- **`src/lib/store/useChatStore.ts`** — Tracks three independent selections: `selectedModel` (classic chat/image), `selectedAgentModel` (ops), `selectedAgentImageModel` (image). Defaults are resolved from the unified selectable list.

### Agent Architecture

The Agent Edge Function implements a **planner-executor loop** (`supabase/functions/_shared/utils/agent-orchestrator.ts`):

1. **Planner** — Receives truncated history, returns `AgentPlannerResult` with `steps`, `needsSearch`, `needsImageSearch`, `executionMode`.
2. **Executor** — Receives history + plan + tool results, returns either a `final` JSON answer or a `tool_call`.
3. **`runAgentLoop()`** — Orchestrates up to `MAX_ITERATIONS`. Emits structured SSE events (`phase`, `plan`, `step_start`, `step_done`, `tool_start`, `tool_result`, `text`, `citation`, `done`).
4. **Tool runner** — `web_search` and `image_search` use external search APIs; `generate_image` reuses `executeSharedImageGeneration()` from the shared image generation core.

### Realtime Sync

- **Ops** (`src/lib/realtime/subscribeOps.ts`) — Subscribes to `ops` table inserts per document. Deduplicates via `seq`. Skips self-echoed ops (`localOpTracker`) and skips `addImage` ops that collide with active pending generations (`pendingGenerationTracker`).
- **Jobs** (`src/lib/realtime/subscribeJobs.ts`) — Subscribes to job status updates for image generation progress.
- **Points** (`src/lib/realtime/subscribePoints.ts`) — Subscribes to `user_profiles` updates; `user_profiles.points` is the source of truth for realtime balance.

### Provider Registry & BYOK

- **`supabase/functions/_shared/providers/registry-setup.ts`** — Creates a `ProviderRegistry` mapping model names to provider implementations (Volcengine, Gemini, OpenAI-compatible, etc.).
- **`supabase/functions/_shared/utils/resolve-chat-provider.ts`** — Resolves the chat provider for a selected model, including BYOK path.
- **`supabase/functions/_shared/utils/image-generation-core.ts`** — Shared image generation execution used by both `generate-image` and Agent tool calls.
- BYOK configs are encrypted with AES-256-GCM. Host allowlist validation runs before any external request.

### Persistence Patterns

- Canvas structural changes (add/remove/update) are saved as ops to the `ops` table.
- Layer metadata changes (visibility, lock, rename) are also persisted as ops.
- `localOpTracker` marks locally-saved ops so Realtime self-echo can be skipped.
- Image generation results are saved as `addImage` ops by the client in `useGeneration.ts` after placeholder replacement.

### Important Files

- `src/hooks/chat/useGeneration.ts` — Generation lifecycle and placeholder UX
- `src/lib/canvas/opsExecutor.ts` — Op execution engine
- `src/lib/canvas/canvasSynchronizer.ts` — Canvas ↔ Layer Store sync
- `src/lib/realtime/subscribeOps.ts` — Realtime ops with deduplication
- `supabase/functions/_shared/services/points.ts` — Points deduction and refund logic
- `supabase/functions/_shared/utils/agent-orchestrator.ts` — Agent loop primitives
- `supabase/functions/_shared/utils/chat-provider-json.ts` — Unified LLM JSON caller with retry

## Current Functionality (as checked on 2026-03-01)

### Auth & Account
- Email/password login + registration via Supabase; logout; profile page with points and history.

### Project Management
- Create projects (default document + conversation), list recent/all projects, delete projects, rename in editor.

### Editor Layout
- Fabric.js canvas + chat panel; left toolbar (select/box select/rect/text/pencil/image upload/AI); layer panel toggle; points indicator; language + theme controls.

### Canvas Editing
- Pan/zoom/fit view, selection info, context menu (copy/paste/delete/arrange), undo/redo history, drag/drop images, text toolbar (font/size/style/color/align), image toolbar (download/copy/delete, lock, layer order, AI tools).

### Layer System & Ops
- Ops-based persistence for add/update/remove + visibility/lock/rename; debounced updateLayer persistence; ops replay on load; local-op tracking to prevent self-echo.

### AI Generation
- Chat-based ops generation (plan + ops), image generation jobs with model selector, aspect ratio + resolution, reference image support, and placeholder UX; image tools (remove background, upscale, erase, expand) create new assets/ops.
- **BYOK Support**: Users can configure their own image generation providers (Volcengine, OpenAI-compatible APIs) via Settings panel.

### Realtime Sync
- Supabase Realtime for ops, jobs, messages, and points with seq-based deduplication.

### Assets & Export
- Generated assets stored in storage (COS/Supabase); chat @-mention to reference assets; image toolbar download; PNG export helpers in canvas utilities.

### Points & Membership
- Points balance indicator, insufficient points dialog, membership pricing from `membership_configs`, payment feature flag, points cost per model.

### i18n & Theming
- zh-CN/en-US locales, LanguageSwitcher, light/dark theme toggle.

### Provider Configuration (BYOK)
- User can add/edit/delete custom provider configs (Volcengine, OpenAI-compatible)
- API keys encrypted with AES-256-GCM before storage
- Host allowlist validation (production: system_settings, dev: env)
- Multi-config support per provider type
- Test connection before saving
- No points deducted for user-configured models (BYOK = free)
- UI: ProviderConfigPanel and ProviderConfigForm components

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (organized by feature)
├── lib/           # Utilities, client configurations, and business logic
└── ai/            # AI-related schemas and validation
tests/             # Vitest test files
supabase/          # Supabase Edge Functions and migrations
```

## Code Style Guidelines

### Imports
- Use absolute imports with `@/*` alias for src directory
- Group imports: React/third-party -> local imports -> types

### TypeScript
- Strict mode enabled - all types must be properly defined
- Use `interface` for object shapes, `type` for unions and primitives
- Always type function parameters and return values
- Export types alongside functions when they're meant to be public

### Naming Conventions
- Components: PascalCase (`ChatMessage.tsx`)
- Functions: camelCase (`fetchMessages`)
- Files: kebab-case for utilities (`ops-executor.ts`), PascalCase for components
- Test files: `*.test.ts` or `*.spec.ts`

### React Patterns
- Use `'use client'` directive for client components
- Prefer `useCallback` for event handlers passed to children
- Use `cn()` utility for conditional class merging
- Destructure props in function signature

### Error Handling
- API routes return structured errors: `{ error: { code: 'ERROR_CODE', message: 'Description' } }`
- Use try/catch in async functions, always log errors with context
- Don't suppress errors - let them bubble up or handle gracefully

### File Comments
- Add JSDoc-style comment blocks at the top of files describing purpose
- Reference requirements when applicable: `Requirements: 3.10 - Configure Auth and Realtime`

### Testing
- Use Vitest with fast-check for property-based testing
- Group related tests in describe blocks with descriptive names
- Test both happy paths and error cases
- Mock external dependencies (Supabase, APIs)

### UI Components
- Use shadcn/ui components from `@/components/ui/*`
- Use Tailwind utility classes directly or via `cn()` helper
- Support dark mode with `dark:` prefix

### State Management
- Use React hooks for local component state
- Use Zustand for global state if needed
- Use Supabase Realtime for database subscriptions

### API Routes
- Use Next.js App Router: `src/app/api/*/route.ts`
- Validate request body before processing
- Return appropriate HTTP status codes
- Always handle errors in catch blocks

## Class and Error Patterns

### Custom Error Classes
```typescript
export class OpsExecutionError extends Error {
  constructor(message: string, public op: Op, public cause?: Error) {
    super(message);
    this.name = 'OpsExecutionError';
  }
}
```

### Class Configuration Interfaces
```typescript
export interface OpsExecutorConfig {
  canvas: fabric.Canvas;
  onOpExecuted?: (op: Op, index: number) => void;
  onError?: (error: Error, op: Op) => void;
}
```

### Static Constants
```typescript
private static readonly DEFAULT_ANIMATION_DURATION = 280;
private static readonly DEFAULT_STAGGER_DELAY = 50;
```

## Barrel Exports

Use `index.ts` files in component directories to export public API:
```typescript
export { ChatMessage } from './ChatMessage';
export { ChatInput } from './ChatInput';
```

## Testing Patterns

### Property-Based Testing with fast-check
```typescript
const layerIdArb = fc.nat({ max: 99999999 })
  .map(n => `layer-${n.toString(16).padStart(8, '0')}`);

fc.assert(
  fc.property(validOpArb, (op) => {
    expect(validateOp(op)).toBe(true);
    return true;
  }),
  { numRuns: 100 }
);
```

### Test File Structure
```typescript
/**
 * Feature: feature-name
 * Property N: Description
 * Validates: Requirements X.X-X.X
 */
describe('Property N: Description', () => {
  it('should behave correctly for valid input', () => {
    // test implementation
  });
});
```

## Console Logging

Use prefixed console logs for debugging:
```typescript
console.log('[API] Edge Function response:', { status: response.status, data });
console.error('[OpsExecutor] Failed to load image:', payload.id, error);
console.warn(`[OpsExecutor] Layer with id "${id}" not found, skipping update`);
```
