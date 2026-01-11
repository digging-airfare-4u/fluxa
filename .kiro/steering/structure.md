# ChatCanvas Project Structure

## Directory Layout

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (Next.js)
│   │   └── generate-ops/  # Proxy to Supabase Edge Function
│   ├── app/               # Main app routes (authenticated)
│   │   ├── page.tsx       # Home page with project grid
│   │   └── p/[projectId]/ # Editor page
│   ├── auth/              # Authentication page
│   ├── layout.tsx         # Root layout with ThemeProvider
│   └── globals.css        # Global styles & CSS variables
│
├── components/
│   ├── canvas/            # Canvas-related components
│   │   ├── CanvasStage.tsx    # Main Fabric.js canvas wrapper
│   │   ├── ContextMenu.tsx    # Right-click context menu
│   │   └── SelectionInfo.tsx  # Selection overlay info
│   ├── chat/              # Chat panel components
│   │   ├── ChatPanel.tsx      # Main chat container
│   │   ├── ChatInput.tsx      # Message input
│   │   └── ChatMessage.tsx    # Message display
│   ├── editor/            # Editor layout components
│   │   ├── EditorLayout.tsx   # Main editor container
│   │   ├── LeftToolbar.tsx    # Tool selection sidebar
│   │   └── TopToolbar.tsx     # Top action bar
│   ├── home/              # Home page components
│   │   ├── HomeInput.tsx      # Prompt input
│   │   ├── ProjectGrid.tsx    # Project cards grid
│   │   └── QuickTags.tsx      # Quick prompt tags
│   └── ui/                # shadcn/ui components
│
├── lib/
│   ├── canvas/
│   │   ├── ops.types.ts       # Op type definitions
│   │   ├── opsExecutor.ts     # Executes ops on canvas
│   │   └── export.ts          # Canvas export utilities
│   ├── realtime/          # Supabase Realtime subscriptions
│   │   ├── subscribeOps.ts    # Ops change subscription
│   │   └── subscribeJobs.ts   # Job status subscription
│   ├── supabase/
│   │   ├── client.ts          # Supabase client instance
│   │   └── queries/           # Database query functions
│   ├── theme/             # Theme context & toggle
│   └── utils.ts           # Utility functions (cn, etc.)
│
└── ai/
    └── schema/            # JSON Schema for AI ops validation

supabase/
├── schema.sql             # Database schema
├── rls.sql               # Row Level Security policies
├── storage.sql           # Storage bucket config
└── functions/            # Edge Functions (Deno)
    ├── generate-ops/     # AI ops generation
    └── generate-image/   # AI image generation

tests/                    # Vitest test files
├── canvas/              # Canvas/ops tests
├── schema/              # Schema validation tests
└── rls/                 # RLS policy tests

docs/                    # API documentation
├── api.md              # Edge Function API docs
└── storage.md          # Storage usage docs
```

## Key Patterns

### Component Organization
- Feature-based folders under `components/`
- Each folder has an `index.ts` barrel export
- Components use `'use client'` directive when needed

### Ops Architecture
- All canvas changes are `Op` objects (see `ops.types.ts`)
- `OpsExecutor` class handles op execution on Fabric.js canvas
- Ops are stored in database for replay/sync

### Path Aliases
- `@/*` maps to `./src/*` (configured in tsconfig.json)

### Styling Convention
- CSS variables defined in `globals.css` for theming
- Light/dark theme support via `.dark` class
- Use `cn()` utility for conditional class merging
