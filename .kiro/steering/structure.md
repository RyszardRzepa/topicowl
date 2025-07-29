# Project Structure

## Architecture Patterns

### Next.js App Router Structure
- **Route Handlers**: API routes in `src/app/api/` with colocated types
- **Page Components**: UI pages in `src/app/` with nested routing
- **Server Components**: Default server-side rendering with client components marked explicitly

### Database Layer
- **Schema-first**: Single schema file `src/server/db/schema.ts` with Drizzle ORM
- **Multi-tenant**: Uses PostgreSQL schema `content-machine` for isolation
- **Migrations**: Versioned migrations in `drizzle/` directory

### Component Organization
```
src/components/
├── ui/           # Reusable UI primitives (shadcn/ui pattern)
├── articles/     # Article-specific components
├── workflow/     # Workflow dashboard components
├── settings/     # Settings page components
├── onboarding/   # Onboarding flow components
└── auth/         # Authentication components
```

### API Route Patterns
```
src/app/api/
├── articles/     # Article CRUD and workflow operations
├── settings/     # User settings and configuration
├── webhooks/     # External webhook handlers (Clerk, etc.)
├── cron/         # Scheduled job endpoints
└── onboarding/   # User onboarding flow
```

## Key Directories

### `/src/app/`
- **Pages**: React Server Components for UI routes
- **API Routes**: RESTful endpoints with colocated request/response types
- **Layouts**: Shared layouts with authentication checks

### `/src/components/`
- **Feature-based organization** by domain (articles, workflow, settings)
- **ui/**: Reusable primitives following shadcn/ui patterns
- **Client components** explicitly marked with `"use client"`

### `/src/server/`
- **Database**: Drizzle schema and connection setup
- **Server-only code**: Database queries and business logic

### `/src/types.ts`
- **Shared domain types**: Core business entities (Article, BlogPost, etc.)
- **API types**: Colocated with routes for request/response schemas

## Naming Conventions

### Files & Directories
- **kebab-case** for directories and files
- **PascalCase** for React components
- **camelCase** for TypeScript files and utilities

### Database
- **snake_case** for table and column names
- **Descriptive prefixes**: `webhook_`, `generation_`, `scheduling_`

### API Routes
- **RESTful patterns**: `/api/articles/[id]/action`
- **Nested resources**: `/api/articles/[id]/schedule`
- **Bulk operations**: `/api/articles/generate` (POST with array)

## Code Organization Principles

### Type Safety
- **Zod schemas** for API validation
- **Colocated types** with API routes
- **Shared domain types** in `/src/types.ts`

### Error Handling
- **Consistent API responses** with `ApiResponse<T>` wrapper
- **Graceful degradation** in UI components
- **Error boundaries** for React error handling

### State Management
- **Server state**: React Server Components + database queries
- **Client state**: React hooks for UI state
- **URL state**: Search params for navigation state

### Authentication
- **Clerk integration** with middleware protection
- **User context** available in all protected routes
- **Database user mapping** via `clerk_user_id`