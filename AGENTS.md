# AGENTS.md

This guide is for agentic coding assistants working on the Fluxa codebase.

## Commands

### Development
```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Testing
```bash
pnpm test           # Run all tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with coverage report

# Run a single test file
pnpm test path/to/test.test.ts

# Run tests matching a pattern
pnpm test -- pattern
```

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
- Group imports: React/third-party → local imports → types

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
