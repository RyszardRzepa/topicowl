---
applyTo: "**"             
description: Global repo standards
---

MOST IMPORTANT INSTURCITONS TO FOLLOW:
Think cerfully and only action the specific task I have given to you with most consise and elegant solution that changes as little code as possible.

Dont create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.
Always use ?? insetead of ||.

Make sure that we dont create new util functions, we should inlice code where is used.

A new API route has been created or modified. Please review the code to ensure it implements proper security measures:

1. **Authentication Check**: Verify the route properly authenticates users (using Clerk auth() or similar)
2. **User Data Isolation**: Ensure users can only access their own data - check for proper user ID filtering in database queries
3. **Project Context**: If applicable, verify project-based data isolation is implemented
4. **Authorization**: Check that users have proper permissions for the requested operations
5. **Input Validation**: Ensure request data is properly validated and sanitized
6. **Error Handling**: Verify sensitive information is not leaked in error responses

Focus on identifying any potential security vulnerabilities where users might be able to access data belonging to other users. Provide specific recommendations for fixing any security issues found.


---
applyTo: "**"             
description: Global repo standards
---
# Product Overview

Contentbot is an AI-powered content generation platform that helps businesses create, manage, and publish SEO-optimized articles through automated workflows with multi-project support.

## Core Features

- **Multi-Project Support**: Manage multiple websites/brands from a single account with project-based isolation
- **AI Article Generation**: Multi-phase content creation using Gemini, Claude, and OpenAI models
- **Workflow Dashboard**: Three-phase workflow management (Planning → Generations → Publishing)
- **Kanban Board**: Visual article management through idea → scheduled → generating → published pipeline
- **SEO Optimization**: Automated keyword research, internal linking, and meta tag generation
- **Publishing Automation**: Scheduled content publishing with webhook notifications
- **Image Integration**: Unsplash and Pexels integration for cover images with proper attribution
- **Video Embedding**: YouTube video integration for enhanced content
- **Reddit Integration**: Research content ideas and trends from Reddit communities
- **User Onboarding**: Website analysis and automated content strategy setup
- **Credit System**: Usage-based credit system for article generation
- **Quality Control**: AI-powered quality checks and validation before publishing

## Target Users

Business owners, content teams, and digital marketers who need to scale their content marketing efforts across multiple projects through AI-powered automation while maintaining quality and SEO best practices.

## Key Workflows

### 1. Project Management
- Create and manage multiple projects (websites/brands)
- Project-specific settings and configurations
- Project switching and context management

### 2. Content Planning
- Generate article ideas based on project's domain and keywords
- Reddit integration for trend research and content inspiration
- AI-powered idea generation with target audience analysis

### 3. Content Generation
- Multi-step AI process: research → outline → writing → quality control → validation
- Real-time generation progress tracking
- Generation queue management with scheduling
- Credit-based usage tracking

### 4. Content Management
- Workflow dashboard with three phases (Planning, Generations, Publishing)
- Kanban board for visual article lifecycle management
- Article editor with MDX support and live preview
- Metadata management and SEO optimization

### 5. Publishing Pipeline
- Scheduled content publishing with date/time selection
- Webhook delivery to external systems (CMS, websites)
- Publishing status tracking and retry mechanisms
- Article preview and final review before publishing

## Architecture Highlights

- **Multi-tenant**: Project-based data isolation for scalability
- **Real-time**: Live generation progress and status updates
- **Extensible**: Modular AI model integration (Gemini, Claude, OpenAI)
- **Reliable**: Queue-based generation with retry mechanisms
- **Secure**: Webhook signature verification and secure API endpoints

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


---
applyTo: "**"             
description: Global repo standards
---

MOST IMPORTANT INSTRUCTIONS TO FOLLOW:
Think carefully and only action the specific task I have given to you with most concise and elegant solution that changes as little code as possible.

Don't create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types.ts` and colocated types in the API route files.
Don't create scripts files for testing.
Always use ?? instead of ||.

Make sure that we don't create new util functions, we should inline code where it is used.

## Framework & Runtime
- **Next.js 15.2.3** with App Router (React 19)
- **TypeScript 5.8.2** with strict mode enabled
- **Node.js** with ES modules

## Database & ORM
- **PostgreSQL** with Drizzle ORM 0.41.0
- **Drizzle Kit 0.30.5** for migrations and schema management
- Schema: `contentbot` schema with prefixed tables
- Multi-project support with project-based data isolation

## Authentication & User Management
- **Clerk 6.25.4** for authentication and user management
- **Svix 1.69.0** for webhook signature verification
- Webhook integration for user lifecycle events

## AI & External APIs
- **Vercel AI SDK 5.0.4** for LLM integration
- **Google Gemini** via @ai-sdk/google 2.0.2 (primary models: 2.0-flash-exp, 2.5-flash, 2.5-pro)
- **Google Vertex AI** via @ai-sdk/google-vertex 3.0.3
- **Anthropic Claude** via @ai-sdk/anthropic 2.0.1 (Sonnet 4)
- **OpenAI GPT** via @ai-sdk/openai 2.0.7 (GPT-5)
- **Unsplash API** for image search and selection
- **Pexels API** for additional image search and selection
- **Reddit API** integration for content research

## UI & Styling
- **Tailwind CSS 4.0.15** with custom brand color system
- **Radix UI** components for accessibility
- **Lucide React 0.525.0** for icons
- **MDXEditor 3.40.1** for rich text editing
- **Hello Pangea DnD 18.0.1** for kanban functionality
- **React Day Picker 9.8.1** for date selection
- **Sonner 2.0.6** for toast notifications

## Development Tools
- **ESLint 9.23.0** with Next.js config
- **Prettier 3.5.3** with Tailwind plugin
- **TypeScript ESLint 8.27.0** for code quality
- **TSX 4.20.3** for TypeScript execution

## Environment Management
- **T3 Env 0.12.0** for type-safe environment variables
- **Zod 3.24.2** for runtime validation

## Content Processing
- **React Markdown 10.1.0** for markdown rendering
- **Remark GFM 4.0.1** for GitHub Flavored Markdown
- **Remark Breaks 4.0.0** for line break handling
- **Rehype Highlight 7.0.2** for syntax highlighting

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Turbo
npm run build           # Production build
npm run start           # Start production server
npm run preview         # Build and start locally

# Database
npm run db:generate     # Generate Drizzle migrations
npm run db:migrate      # Run migrations
npm run db:push         # Push schema changes
npm run db:studio       # Open Drizzle Studio

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run typecheck       # TypeScript type checking
npm run format:check    # Check Prettier formatting
npm run format:write    # Apply Prettier formatting
npm run check           # Run lint + typecheck together
```

## Deployment
- **Vercel** platform optimized
- **Vercel Functions 2.2.5** for serverless functions
- Environment variables managed through Vercel dashboard
- Automatic deployments on git push