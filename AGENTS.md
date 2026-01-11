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
- Example:
  ```typescript
  import { useState, useCallback } from 'react';
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';
  import type { Message } from '@/lib/supabase/queries/messages';
  ```

### TypeScript
- Strict mode enabled - all types must be properly defined
- Use `interface` for object shapes, `type` for unions and primitives
- Always type function parameters and return values
- Use type guards for runtime type checking
- Export types alongside functions when they're meant to be public

### Naming Conventions
- Components: PascalCase (`ChatMessage.tsx`)
- Functions: camelCase (`fetchMessages`)
- Constants: UPPER_SNAKE_CASE or camelCase depending on scope
- Files: kebab-case for utilities (`ops-executor.ts`), PascalCase for components
- Test files: `*.test.ts` or `*.spec.ts`

### React Patterns
- Use `'use client'` directive for client components
- Prefer `useCallback` for event handlers passed to children
- Use `cn()` utility for conditional class merging
- Destructure props in function signature
- Export components as named exports, with default export optional

### Error Handling
- Throw `Error` objects with descriptive messages: `throw new Error('Failed to fetch messages: ${error.message}')`
- API routes return structured errors: `{ error: { code: 'ERROR_CODE', message: 'Description' } }`
- Use try/catch in async functions, always log errors with context
- Don't suppress errors - let them bubble up or handle gracefully

### File Comments
- Add JSDoc-style comment blocks at the top of files describing purpose
- Reference requirements when applicable: `Requirements: 3.10 - Configure Auth and Realtime`
- Document exported functions with parameter and return descriptions

### Testing
- Use Vitest with fast-check for property-based testing
- Group related tests in describe blocks with descriptive names
- Test both happy paths and error cases
- Use property-based testing for functions with complex input validation
- Mock external dependencies (Supabase, APIs)

### UI Components
- Use shadcn/ui components from `@/components/ui/*`
- Prefer composition over custom implementations
- Use Tailwind utility classes directly or via `cn()` helper
- Support dark mode with `dark:` prefix

### State Management
- Use React hooks for local component state
- Use Zustand for global state if needed
- Use Supabase Realtime for database subscriptions
- Avoid prop drilling when simple state lifting suffices

### API Routes
- Use Next.js App Router: `src/app/api/*/route.ts`
- Validate request body before processing
- Return appropriate HTTP status codes
- Structure JSON responses consistently
- Always handle errors in catch blocks

### Type Exports
- Export types from the same file that defines them
- Group related types and functions together
- Keep types in dedicated `*.types.ts` files for complex domain models
- Use type guards for runtime validation

### General Guidelines
- Keep functions focused and single-purpose
- Extract reusable logic into utilities in `lib/`
- Use descriptive variable and function names
- Comment non-obvious logic, not self-explanatory code
- Follow existing patterns in the codebase
