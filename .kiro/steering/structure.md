# Project Structure

## Root Directory
- **Configuration files**: `next.config.js`, `drizzle.config.ts`, `tsconfig.json`, `eslint.config.js`, `prettier.config.js`
- **Environment**: `.env`, `.env.example` for environment variables
- **Database**: `drizzle/` folder contains migrations and metadata
- **Documentation**: `docs/` folder contains architecture and implementation docs

## Source Code Organization (`src/`)

### App Router Structure (`src/app/`)
- **Root layout**: `layout.tsx` - Global app layout and metadata
- **Home page**: `page.tsx` - Main application entry point
- **API routes**: `api/` - RESTful endpoints organized by feature
- **Page routes**: Feature-specific pages (articles, settings, onboarding, etc.)

### API Route Organization (`src/app/api/`)
```
api/
├── articles/               # Article management
│   ├── [id]/              # Dynamic article routes
│   │   ├── generation-status/ # Check generation progress
│   │   └── schedule/       # Schedule article publishing
│   ├── board/             # Kanban board state
│   ├── generate/          # Trigger article generation
│   ├── images/            # Image search and selection
│   ├── move/              # Handle drag-and-drop
│   ├── publish/           # Article publishing
│   ├── research/          # Content research
│   ├── schedule-generation/ # Schedule generation tasks
│   ├── update/            # Article updates
│   ├── validate/          # Content validation
│   └── write/             # Content writing
├── cron/                  # Scheduled tasks
│   ├── generate-articles/ # Automated generation cron job
│   └── webhook-retries/   # Webhook retry handling
├── onboarding/            # User onboarding flow
│   ├── analyze-website/   # Website analysis
│   ├── complete/          # Complete onboarding
│   └── status/            # Onboarding status
├── settings/              # Application settings
│   ├── [id]/              # Dynamic settings routes
│   └── webhooks/          # Webhook configuration
└── webhooks/              # External webhook handlers
    └── clerk/             # Clerk authentication webhooks
```

### Page Routes (`src/app/`)
- **Articles**: `articles/[id]/` - Individual article pages
- **Settings**: `settings/` - Application configuration
- **Onboarding**: `onboarding/` - User onboarding flow
- **Authentication**: `sign-in/`, `sign-up/` - Auth pages
- **Demo**: `demo/` - Demo/preview functionality

### Components (`src/components/`)
- **UI components**: `ui/` - Reusable UI components (buttons, cards, forms, etc.)
- **Articles**: `articles/` - Article-specific components (editor, preview, actions)
- **Auth**: `auth/` - Authentication-related components
- **Kanban**: `kanban/` - Kanban board implementation
- **Onboarding**: `onboarding/` - Onboarding flow components
- **Settings**: `settings/` - Settings page components
- **Workflow**: `workflow/` - Workflow dashboard and pipeline components
- **Component naming**: kebab-case with `.tsx` extension

### Types (`src/types.ts`)
- **Shared domain types**: Common interfaces and types used across the application
- **API types**: Each API route defines and exports its own request/response types for colocation

### Database Layer (`src/server/`)
- **Database connection**: `db/index.ts` - Drizzle database instance
- **Schema definition**: `db/schema.ts` - All database tables and types

### Utilities (`src/lib/`)
- **utils.ts**: Essential shared utilities (no business logic)

### Hooks (`src/hooks/`)
- **use-generation-polling.ts**: Polling hook for generation status
- **use-generation-status.ts**: Generation status management hook

### Styles (`src/styles/`)
- **globals.css**: Global CSS styles and Tailwind imports

### Configuration Files
- **constants.ts**: Application constants
- **env.js**: Environment variable validation
- **middleware.ts**: Next.js middleware configuration

## Key Conventions

### File Naming
- **Components**: kebab-case (e.g., `kanban-board.tsx`)
- **API routes**: `route.ts` in feature folders with colocated types
- **Types**: Domain types in `src/types.ts`, API types colocated with routes
- **Database**: snake_case for table/column names, camelCase for TypeScript

### Code Organization Principles
- **No services layer**: All business logic written directly in API route handlers
- **Inline logic**: Keep related functionality together in the same file
- **Colocated types**: Each API route defines and exports its own request/response types
- **Type safety**: Full TypeScript coverage with types colocated near their usage

### Database Schema
- **ID generation**: Custom nanoid for public IDs
- **Timestamps**: `createdAt` and `updatedAt` with automatic updates
- **Enums**: PostgreSQL enums for status fields

### API Structure
- **RESTful endpoints**: Standard HTTP methods
- **Error handling**: Consistent error responses with status codes
- **Type safety**: Each route defines and exports its own types for colocation
- **Self-contained**: All logic written directly in route handlers

### Environment Variables
- **Validation**: T3 Env with Zod schemas
- **Server vs Client**: Clear separation of server-side and client-side variables
- **Required variables**: `DATABASE_URL` for database connection

## Architecture Reference
See `architecture.md` for detailed guidelines on implementing the no-services architecture pattern.
````