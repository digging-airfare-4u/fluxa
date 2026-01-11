# Fluxa

AI-powered design generation platform that enables users to create visual designs through natural language conversation.

[中文文档](./docs/README.zh-CN.md)

## Features

- **Conversational Design** - Describe your design needs in chat, AI generates canvas operations
- **Ops-Driven Architecture** - All canvas changes are discrete, replayable operations
- **Real-time Canvas** - Fabric.js-based infinite canvas with pan/zoom
- **Project Management** - Multi-project support with documents and conversations
- **Asset Management** - Upload, AI-generate, and export images
- **Membership Points** - Usage-based points system for AI operations

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| Canvas | Fabric.js 7 |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| State | Zustand |
| Validation | AJV |
| Testing | Vitest, fast-check |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/fluxa.git
cd fluxa

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

Configure `.env` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
<<<<<<< HEAD
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AI_API_KEY=your_openai_api_key
AI_MODEL=gpt-4o-mini
```

=======
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

AI API keys are configured in Supabase Edge Function Secrets (Dashboard > Edge Functions > Secrets).

>>>>>>> 01ebc1c (feat: 文档补充)
### Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build for production
pnpm build
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── app/               # Main app routes (authenticated)
│   └── auth/              # Authentication page
├── components/
│   ├── canvas/            # Canvas components (CanvasStage, ContextMenu)
│   ├── chat/              # Chat panel components
│   ├── editor/            # Editor layout components
│   ├── home/              # Home page components
│   ├── points/            # Points/membership components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── canvas/            # Ops types and executor
│   ├── realtime/          # Supabase Realtime subscriptions
│   ├── selection/         # Selection state management
│   ├── store/             # Zustand stores
│   └── supabase/          # Supabase client and queries
└── ai/
    └── schema/            # JSON Schema for AI ops validation

supabase/
├── functions/             # Edge Functions (Deno)
│   ├── generate-ops/      # AI ops generation
│   └── generate-image/    # AI image generation
└── *.sql                  # Database schema and migrations

tests/                     # Vitest test files
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      EditorLayout                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CanvasStage (Fabric.js)  │  ChatPanel                  ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Ops Engine                            ││
│  │  - createFrame, setBackground, addText, addImage        ││
│  │  - updateLayer, removeLayer                             ││
│  └─────────────────────────┬───────────────────────────────┘│
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
│  PostgreSQL │ Auth │ Realtime │ Storage │ Edge Functions    │
└─────────────────────────────────────────────────────────────┘
```

## User Flow

1. User creates a project from the home page (optionally with an initial prompt)
2. Project opens in the editor with canvas and chat panel
3. User describes designs in chat → AI generates ops → ops execute on canvas
4. User can manually edit, export, or continue iterating via chat

## License

MIT
