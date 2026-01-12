# Fluxa Tech Stack

## Core Framework

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with TypeScript (strict mode)
- **pnpm** as package manager

## UI & Styling

- **Tailwind CSS 4** with CSS variables for theming
- **shadcn/ui** (new-york style) for UI components
- **Radix UI** primitives for accessible components
- **Lucide React** for icons
- **class-variance-authority** + **clsx** + **tailwind-merge** for styling utilities

## Canvas

- **Fabric.js 7** for canvas rendering and manipulation
- Ops-driven architecture: all canvas changes are discrete operations
- Infinite canvas with pan/zoom support

## Backend & Database

- **Supabase** for:
  - PostgreSQL database
  - Authentication
  - Realtime subscriptions
  - Storage (assets bucket)
  - Edge Functions (Deno runtime)

## State Management

- **Zustand** for client state
- Supabase Realtime for cross-client sync

## Validation

- **AJV** with ajv-formats for JSON Schema validation

## Testing

- **Vitest** for unit/integration tests
- **fast-check** for property-based testing
- Tests located in `tests/` directory

## Common Commands

```bash
# Development
pnpm dev          # Start dev server

# Build & Production
pnpm build        # Build for production
pnpm start        # Start production server

# Testing
pnpm test         # Run tests once
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage

# Linting
pnpm lint         # Run ESLint
```

## Environment Variables

Required in `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

AI API keys are configured in Supabase Edge Function Secrets.
