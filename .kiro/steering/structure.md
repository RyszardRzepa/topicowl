# Project Structure

## Root Level
- **Configuration files**: `next.config.js`, `tailwind.config.js`, `tsconfig.json`, `drizzle.config.ts`
- **Environment**: `.env.example` template, `.env` (gitignored)
- **Documentation**: `README.md`, `docs/` folder for implementation guides

## Source Code (`src/`)

### App Router (`src/app/`)
Next.js 15 App Router structure with nested layouts:

```
src/app/
├── layout.tsx                    # Root layout
├── page.tsx                      # Landing page
├── dashboard/                    # Main application
│   ├── layout.tsx               # Dashboard layout with nav
│   ├── page.tsx                 # Dashboard home
│   ├── articles/                # Article management
│   └── settings/                # User settings
├── onboarding/                  # User onboarding flow
├── sign-in/[[...sign-in]]/      # Clerk auth pages
├── sign-up/[[...sign-up]]/      # Clerk auth pages
└── api/                         # API routes
    ├── articles/                # Article CRUD & generation
    ├── settings/                # Settings management
    ├── webhooks/                # External webhooks
    ├── cron/                    # Scheduled tasks
    └── onboarding/              # Onboarding endpoints
```

### Components (`src/components/`)
Organized by feature and reusability:

```
src/components/
├── ui/                          # Reusable UI primitives (Radix-based)
├── articles/                    # Article-specific components
├── workflow/                    # Kanban & workflow components
├── settings/                    # Settings forms & displays
├── onboarding/                  # Onboarding flow components
├── auth/                        # Authentication helpers
└── layout/                      # Layout components
```

### Server Layer (`src/server/`)
- **Database**: `db/index.ts` (connection), `db/schema.ts` (Drizzle schema)
- **Schema prefix**: All tables use `contentbot_*` naming

### Utilities & Configuration
- **Types**: `src/types.ts` (shared domain types)
- **Constants**: `src/constants.ts` (API URLs, model names)
- **Environment**: `src/env.js` (T3 Env validation)
- **Utilities**: `src/lib/utils/` (domain-specific helpers)
- **Hooks**: `src/hooks/` (React hooks)
- **Styles**: `src/styles/` (global CSS, component styles)

## Database Migrations (`drizzle/`)
- **Migrations**: Numbered SQL files (`0000_*.sql`)
- **Metadata**: `meta/` folder with snapshots and journal

## Key Conventions

### File Naming
- **Components**: PascalCase (`ArticleEditor.tsx`)
- **Pages**: lowercase (`page.tsx`, `layout.tsx`)
- **API routes**: lowercase (`route.ts`)
- **Utilities**: kebab-case (`article-generation.ts`)

### Import Aliases
- `@/*` maps to `src/*` for clean imports
- Prefer absolute imports over relative for `src/` files

### Component Organization
- **UI components**: Generic, reusable primitives
- **Feature components**: Domain-specific, business logic
- **Page components**: Route-specific, composition focused

### API Route Structure
- **RESTful patterns**: `/api/articles/[id]/route.ts`
- **Action-based**: `/api/articles/generate/route.ts`
- **Nested resources**: `/api/articles/[id]/cancel-schedule/route.ts`

### Database Schema
- **Prefixed tables**: `contentbot_users`, `contentbot_articles`
- **Timestamps**: `created_at`, `updated_at` with timezone
- **JSON fields**: Use `jsonb` for structured data
- **Enums**: PostgreSQL enums for status fields