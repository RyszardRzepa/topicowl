---
applyTo: "**"             
description: Global repo standards
---
# Project Structure

## Root Directory
- **`src/`** - Main application source code
- **`public/`** - Static assets (images, icons, favicon)
- **`drizzle/`** - Database migrations and metadata
- **`docs/`** - Project documentation and implementation plans
- **`.kiro/`** - Kiro AI assistant configuration and specs

## Source Code Organization (`src/`)

### App Router (`src/app/`)
- **`api/`** - API routes and server-side logic
  - `articles/` - Article CRUD, generation, publishing
  - `cron/` - Scheduled tasks and background jobs
  - `onboarding/` - User onboarding flow
  - `settings/` - User settings and configuration
  - `webhooks/` - External webhook handlers
- **`dashboard/`** - Main application pages
- **`onboarding/`** - User setup flow
- **`sign-in/`, `sign-up/`** - Authentication pages

### Components (`src/components/`)
- **`articles/`** - Article-specific UI components
- **`auth/`** - Authentication-related components
- **`kanban/`** - Kanban board implementation
- **`onboarding/`** - User onboarding UI
- **`settings/`** - Settings forms and displays
- **`ui/`** - Reusable UI components (shadcn/ui)
- **`workflow/`** - Content workflow components

### Server Layer (`src/server/`)
- **`db/`** - Database configuration and schema
  - `schema.ts` - Drizzle ORM schema definitions
  - `index.ts` - Database connection setup

### Utilities & Configuration
- **`src/lib/`** - Shared utilities and helpers
- **`src/hooks/`** - Custom React hooks
- **`src/styles/`** - Global CSS and component styles
- **`src/types.ts`** - TypeScript type definitions
- **`src/constants.ts`** - Application constants
- **`src/env.js`** - Environment variable validation

## Database Schema (`contentbot` schema)
- **`users`** - User accounts and settings
- **`articles`** - Content items with kanban status
- **`generation_queue`** - Scheduled content generation
- **`article_generation`** - Generation process tracking
- **`webhook_deliveries`** - Webhook delivery logs

## Key Conventions
- Use **App Router** for all new pages and API routes
- Components follow **kebab-case** naming for files
- Database tables use **snake_case** naming
- All database tables prefixed with `contentbot_`
- API routes follow RESTful patterns where possible
- TypeScript strict mode enabled throughout