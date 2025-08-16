---
applyTo: "**"             
description: Global repo standards
---
# Project Structure

## Root Level
- **Configuration files**: `next.config.js`, `tailwind.config.js`, `tsconfig.json`, `drizzle.config.ts`
- **Environment**: `.env.example` template, `.env` (gitignored)
- **Documentation**: `README.md`, `docs/` folder for implementation guides
- **Database**: `drizzle/` folder with migrations and metadata

## Source Code (`src/`)

### App Router (`src/app/`)
Next.js 15 App Router structure with nested layouts:

```
src/app/
├── layout.tsx                    # Root layout
├── page.tsx                      # Landing page
├── dashboard/                    # Main application
│   ├── layout.tsx               # Dashboard layout with nav
│   ├── page.tsx                 # Dashboard home (workflow dashboard)
│   ├── articles/                # Article management
│   │   ├── [id]/               # Individual article pages
│   │   └── page.tsx            # Articles list/kanban
│   ├── projects/               # Project management
│   │   └── new/                # New project creation
│   ├── reddit/                 # Reddit integration
│   └── settings/               # User settings
│       └── reddit/             # Reddit-specific settings
├── onboarding/                  # User onboarding flow
├── sign-in/[[...sign-in]]/      # Clerk auth pages
├── sign-up/[[...sign-up]]/      # Clerk auth pages
└── api/                         # API routes
    ├── articles/                # Article CRUD & generation
    │   ├── [id]/               # Article-specific endpoints
    │   ├── board/              # Kanban board data
    │   ├── generate/           # Article generation
    │   ├── generate-ideas/     # AI idea generation
    │   ├── generation-queue/   # Generation queue management
    │   ├── images/             # Image search & selection
    │   ├── outline/            # Article outline generation
    │   ├── publish/            # Publishing endpoints
    │   ├── quality-control/    # Quality control checks
    │   ├── research/           # Research phase
    │   ├── schedule-generation/ # Generation scheduling
    │   ├── schedule-publishing/ # Publishing scheduling
    │   ├── update/             # Article updates
    │   ├── validate/           # Content validation
    │   └── write/              # Writing phase
    ├── credits/                # User credits management
    ├── cron/                   # Scheduled tasks
    │   ├── generate-articles/  # Automated generation
    │   └── webhook-retries/    # Webhook retry handling
    ├── onboarding/             # Onboarding endpoints
    │   ├── analyze-website/    # Website analysis
    │   ├── complete/           # Onboarding completion
    │   └── status/             # Onboarding status
    ├── projects/               # Project management
    ├── reddit/                 # Reddit API integration
    │   ├── auth/               # Reddit OAuth
    │   ├── callback/           # OAuth callback
    │   ├── disconnect/         # Disconnect Reddit
    │   ├── posts/              # Reddit posts
    │   ├── status/             # Connection status
    │   ├── subreddit/          # Subreddit data
    │   ├── subreddits/         # Subreddit search
    │   └── user/               # Reddit user info
    ├── settings/               # Settings management
    │   └── webhooks/           # Webhook configuration
    ├── sitemaps/               # Sitemap functionality
    │   └── fetch/              # Sitemap fetching
    └── webhooks/               # External webhooks
        └── clerk/              # Clerk user webhooks
```

### Components (`src/components/`)
Organized by feature and reusability:

```
src/components/
├── ui/                          # Reusable UI primitives (Radix-based)
│   ├── alert.tsx               # Alert components
│   ├── badge.tsx               # Badge components
│   ├── button.tsx              # Button variants
│   ├── card.tsx                # Card layouts
│   ├── date-time-picker.tsx    # Date/time selection
│   ├── dialog.tsx              # Modal dialogs
│   ├── form.tsx                # Form components
│   ├── input.tsx               # Input fields
│   ├── project-context-indicator.tsx # Project context display
│   ├── reusable-tabs.tsx       # Tab components
│   ├── select.tsx              # Select dropdowns
│   ├── tabs.tsx                # Tab navigation
│   └── ...                     # Other UI primitives
├── articles/                    # Article-specific components
│   ├── nodes/                  # Custom editor nodes
│   ├── article-editor.tsx      # Main article editor
│   ├── article-ideas-generator.tsx # AI idea generation
│   ├── article-metadata-editor.tsx # Metadata editing
│   ├── article-preview.tsx     # Article preview
│   ├── content-editor-with-preview.tsx # Split editor view
│   ├── generation-progress.tsx # Generation progress tracking
│   ├── generation-status.tsx   # Generation status display
│   ├── unsplash-image-picker.tsx # Image selection
│   └── video-embed-preview.tsx # YouTube video embeds
├── workflow/                    # Workflow & kanban components
│   ├── article-card.tsx        # Article cards
│   ├── article-generations.tsx # Generation tracking
│   ├── planning-hub.tsx        # Planning interface
│   ├── publishing-pipeline.tsx # Publishing workflow
│   ├── status-indicator.tsx    # Status indicators
│   └── workflow-dashboard.tsx  # Main workflow view
├── kanban/                     # Kanban board components
│   └── kanban-board.tsx        # Drag & drop board
├── settings/                   # Settings forms & displays
│   ├── article-settings-form.tsx # Article configuration
│   ├── excluded-domains-field.tsx # Domain exclusion
│   ├── reddit-settings.tsx     # Reddit integration settings
│   ├── settings-preview.tsx    # Settings preview
│   └── webhook-settings.tsx    # Webhook configuration
├── onboarding/                 # Onboarding flow components
│   ├── ai-analysis-preview.tsx # Website analysis preview
│   ├── onboarding-progress.tsx # Progress tracking
│   └── website-url-form.tsx    # URL input form
├── auth/                       # Authentication helpers
│   ├── onboarding-checker.tsx  # Onboarding status check
│   └── project-required-checker.tsx # Project requirement check
├── dashboard/                  # Dashboard-specific components
│   ├── credit-balance.tsx      # Credit display
│   └── credit-context.tsx      # Credit context provider
├── layout/                     # Layout components
│   ├── conditional-header.tsx  # Conditional header display
│   └── header-logo.tsx         # Logo component
├── customized/                 # Custom component variants
│   └── tabs/                   # Custom tab implementations
├── project-context.tsx         # Project context management
├── project-switcher.tsx        # Project switching UI
├── dashboard-layout-client.tsx # Dashboard layout client
├── dashboard-nav.tsx           # Dashboard navigation
├── settings-dropdown.tsx       # Settings dropdown menu
└── YouTube.tsx                 # YouTube component
```

### Server Layer (`src/server/`)
- **Database**: `db/index.ts` (connection), `db/schema.ts` (Drizzle schema)
- **Schema**: `contentbot` schema with multi-project support
- **Tables**: Projects, articles, users, generation queue, webhook deliveries

### Utilities & Configuration
- **Types**: `src/types.ts` (shared domain types)
- **Constants**: `src/constants.ts` (API URLs, model names)
- **Environment**: `src/env.js` (T3 Env validation)
- **Utilities**: `src/lib/utils/` (domain-specific helpers)
- **Hooks**: `src/hooks/` (React hooks for credits, generation polling)
- **Styles**: `src/styles/` (global CSS, MDX editor styles)
- **Contexts**: `src/contexts/` (React contexts)

## Database Migrations (`drizzle/`)
- **Migrations**: Numbered SQL files (`0000_*.sql` to `0041_*.sql`)
- **Metadata**: `meta/` folder with snapshots and journal
- **Schema**: Multi-project architecture with project isolation

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
- **Schema**: `contentbot` schema (not prefixed tables)
- **Multi-project**: Project-based data isolation
- **Timestamps**: `created_at`, `updated_at` with timezone
- **JSON fields**: Use `jsonb` for structured data
- **Enums**: PostgreSQL enums for status fields