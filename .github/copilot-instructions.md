IMPORTANT: Ask me questions for any clarification for the task before writing any code.

# AI Coding Agent Instructions

## Core Architecture

**Contentbot** is a multi-project AI content generation platform built with Next.js 15 App Router, PostgreSQL, and Drizzle ORM. The system enforces strict project-based data isolation where all user data is scoped to projects owned by authenticated users.

### Critical Security Pattern
Every API route must follow this exact authentication and authorization flow:

```typescript
// 1. Authenticate user with Clerk
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// 2. Verify user exists in database  
const [userRecord] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
if (!userRecord) return NextResponse.json({ error: 'User not found' }, { status: 404 });

// 3. For project-scoped operations, verify project ownership
const [projectRecord] = await db.select({ id: projects.id }).from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)));
if (!projectRecord) return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
```

## Development Rules (Non-Negotiable)

- **Never use `any` type** - strict TypeScript enforcement  
- **No utility functions in API routes** - inline all business logic directly  
- **No new helpers in `src/lib`** - write logic where it's used
- **Types**: Common types in `src/types.ts`, API-specific types colocated with routes
- **Use `??` instead of `||`** for null coalescing
- **Never run `npm run dev`** - development server is managed separately

## Database Architecture

**Schema**: `contentbot` (aliased as `topicowl` in config) with multi-project isolation:

```typescript
// Key tables relationship
users (id: text) -> projects (userId: text) -> articles (projectId: int)
                                           -> article_generation (projectId: int)
                                           -> generation_queue (projectId: int)
```

**Migration commands**:
- `npm run db:generate` - Generate migrations from schema changes
- `npm run db:migrate` - Apply migrations to database  
- `npm run db:studio` - Open Drizzle Studio for data inspection

## Project Context System

All user interactions happen within a project context. Components use `useProject()` hook:

```typescript
const { currentProject, projects, switchToProject } = useProject();
// currentProject is never null in authenticated routes
// All database queries must filter by projectId
```

## AI Generation Pipeline

Articles flow through a multi-phase generation system:

1. **Planning** (`idea` status) - User creates article concepts
2. **Generation Queue** (`scheduled` -> `generating`) - Queued background processing  
3. **Content Phases** - `research` -> `outline` -> `writing` -> `quality-control` -> `validation` -> `updating`
4. **Publishing** (`wait_for_publish` -> `published`) - Webhook delivery to external systems

Track generation state in `article_generation` table, not `articles` directly.

## Component Architecture Patterns

**Feature-based organization**:
- `src/components/ui/` - Generic Radix primitives  
- `src/components/articles/` - Article-specific features
- `src/components/workflow/` - Kanban and dashboard views
- `src/components/settings/` - Configuration forms

**Key patterns**:
- Server components for data fetching, client components for interactivity
- Project context required for all authenticated views  
- Colocate types with API routes, not in shared files

## API Route Conventions

**Structure**: `/api/{resource}/{[id]/}{action}/route.ts`

Examples:
- `/api/articles/route.ts` - CRUD operations
- `/api/articles/[id]/route.ts` - Single article operations
- `/api/articles/generate/route.ts` - Action-based endpoint  
- `/api/articles/[id]/cancel-schedule/route.ts` - Nested resource action

**Error handling**:
```typescript
try {
  // Route logic
} catch (error) {
  console.error('Route error:', error);
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

## External Integrations

**AI Models**: Vercel AI SDK with Gemini (primary), Claude, OpenAI
**Authentication**: Clerk with webhook user lifecycle management  
**Image Search**: Unsplash API with proper attribution tracking
**Content Research**: Reddit API with project-scoped OAuth tokens stored in Clerk metadata
**Publishing**: Webhook delivery system with retry logic and status tracking

## Development Workflow

**Quality checks**:
- `npm run check` - Run linting and type checking together
- `npm run format:write` - Apply Prettier formatting
- `npm run typecheck` - TypeScript validation

**Database workflow**:
1. Modify `src/server/db/schema.ts`
2. Never run `npm run db:generate` or `npm run db:migrate`.

## Critical Debugging Points

**Project isolation failures**: Check all queries include proper `projectId` filtering  
**Authentication issues**: Verify Clerk `userId` matches database user records
**Generation stuck**: Check `article_generation` table status and error fields
**Webhook delivery**: Monitor `webhook_deliveries` table for failed attempts
**Reddit integration**: Tokens stored as keyed objects in Clerk `privateMetadata`

The system prioritizes data security through multi-layer project isolation - always validate project ownership before any database operations.
