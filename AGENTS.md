MOST IMPORTANT INSTRUCTIONS TO FOLLOW:
Think carefully and only action the specific task I have given to you with most concise and elegant solution that changes as little code as possible.

Don't create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types.ts` and colocated types in the API route files.
Don't create scripts files for testing.
Always use ?? instead of ||.

Don't create test or debug files.

Make sure that we don't create new util functions, we should inline code where it is used.

# AI Coding Agent Instructions

## Core Architecture

**Topicowl** is a multi-project AI content generation platform built with Next.js 15 App Router, PostgreSQL, and Drizzle ORM. The system enforces strict project-based data isolation where all user data is scoped to projects owned by authenticated users.

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
- **Use `??` instead of `||`** for null coalescing
- **Never run `npm run dev`** - development server is managed separately

## Project Structure Rules (Strict Enforcement)

**File Creation Guidelines**:
- **Utils** (`src/lib/utils/`): Pure functions with NO external API calls, only create if used in 3+ places
- **Services** (`src/lib/services/`): Domain-based organization with external API calls (database, AI models, webhooks)
- **Types**: Common types in `src/types.ts`, API-specific types colocated with routes
- **Components**: Feature-based organization, no generic helpers in component files

Key Principles Applied
Single Responsibility: Each directory handles one domain
Clear Naming: Purpose is obvious from directory name
Colocation: Related functionality grouped together
Consistent Structure: Every service follows same pattern
Type Isolation: Types colocated with their domain logic
Import Clarity: Clear import paths, no deep nesting

**Service Structure (Domain-Based)**:
```
src/lib/services/
├── article-generation/           # Main orchestrator
│   ├── index.ts                 # Main generateArticle function
│   ├── pipeline.ts              # Generation pipeline orchestration
│   ├── progress.ts              # Progress tracking utilities
│   └── artifacts.ts             # Artifact management
├── research/
│   ├── index.ts                 # Main research function
│   ├── parallel-api.ts          # Parallel AI integration
│   ├── youtube-search.ts        # YouTube video search
│   └── types.ts                 #
```

**Service Organization Principles**:
- Group by domain/feature, not technical layer
- Each service has clear `index.ts` with main export functions
- Domain-specific types colocated in service `types.ts`
- No redundant naming (avoid `-service` suffixes)
- Single responsibility per service directory

**Forbidden Patterns**:
- Creating utils for single-use code - inline instead
- Database calls in utils - move to services
- Business logic in API routes - inline or extract to services
- Shared state in utils - use React Context or component props
- Mixed concerns in single service files - separate by domain logic

## Database Architecture

**Schema**: `topicowl` (using `contentbotSchema = pgSchema("topicowl")`) with multi-project isolation:

```typescript
// Key tables relationship (contentbot schema)
users (id: text) -> projects (userId: text, id: serial) -> articles (projectId: int)
                                                        -> article_generation (projectId: int) 
                                                        -> generation_queue (projectId: int)
                                                        -> webhook_deliveries (projectId: int)
                                                        -> api_keys (projectId: int)
```

**Key schema patterns**:
- All project-scoped tables include `projectId` foreign key to `projects.id`
- Use `jsonb` fields for structured data (keywords, artifacts, metadata)
- Status fields stored as constrained text values managed in application types
- Composite indexes on `(userId, projectId)` for efficient multi-tenant queries

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

Articles flow through a sophisticated multi-phase generation system with service-based architecture:

1. **Planning** (`idea` status) - User creates article concepts  
2. **Generation Queue** (`scheduled` -> `generating`) - Background processing with `generation-orchestrator.ts`
3. **Content Phases** - `research` -> `outline` -> `writing` -> `quality-control` -> `validation` -> `updating`
4. **Publishing** (`wait_for_publish` -> `published`) - Webhook delivery to external systems

**Service Architecture**: Each phase has dedicated service domain in `src/lib/services/`:
- `article-generation/` - Main generation orchestrator and pipeline coordination
- `research/` - Content research, data gathering, and external API integration
- `content-generation/` - AI-powered article writing and content creation
- `quality-control/` - Content quality assessment and issue detection
- `content-validation/` - SEO and compliance validation
- `content-updates/` - Generic content updates and improvements
- `image-selection/` - Cover image selection and management

**State Management**: Track generation state in `article_generation` table with `artifacts` jsonb field for phase results. Never modify articles table directly during generation.

## Component Architecture Patterns

**Recommended Project Structure** (following Vercel best practices):

```
src/
├── app/                         # Next.js 15 App Router
│   ├── (auth)/                 # Route groups for auth layouts
│   ├── dashboard/              # Main app routes
│   ├── api/                    # API routes with resource-based organization
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # Generic Radix primitives (reusable)
│   ├── features/               # Feature-specific components
│   │   ├── articles/           # Article-specific features
│   │   ├── workflow/           # Kanban and dashboard views
│   │   └── settings/           # Configuration forms
│   └── layout/                 # Layout-specific components
├── lib/
│   ├── services/               # Domain-based service organization (DB, AI, webhooks)
│   ├── utils/                  # Pure utility functions (3+ usage rule)
│   └── hooks/                  # Custom React hooks
├── server/
│   └── db/                     # Database layer (schema, connection)
├── types.ts                    # Shared domain types
├── constants.ts                # App-wide constants
└── env.js                      # Environment validation
```

**Key patterns**:
- Server components for data fetching, client components for interactivity
- Project context required for all authenticated views  
- Colocate types with API routes, not in shared files unless used 3+ places
- Feature-based component organization over generic grouping

## API Route Conventions

**Structure**: `/api/{resource}/{[id]/}{action}/route.ts`

Examples:
- `/api/articles/route.ts` - CRUD operations
- `/api/articles/[id]/route.ts` - Single article operations
- `/api/articles/generate/route.ts` - Action-based endpoint  
- `/api/articles/[id]/cancel-schedule/route.ts` - Nested resource action

**Implementation Rules**:
- Inline all business logic - no separate util functions
- Extract complex operations to services (`src/lib/services/`)
- Colocate request/response types with the route file
- Follow the 3-step auth pattern for every route

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

**AI Models**: Vercel AI SDK with multiple providers:
- **Gemini** (primary): `gemini-2.5-flash`, `gemini-2.5-pro` via `@ai-sdk/google`
- **Claude**: `claude-sonnet-4-20250514` via `@ai-sdk/anthropic` 
- **OpenAI**: `gpt-5-2025-08-07` via `@ai-sdk/openai`
- Model constants defined in `src/constants.ts`

**Authentication**: Clerk with webhook user lifecycle management  
**Image Search**: Unsplash and Pexels APIs with proper attribution tracking
**Content Research**: Reddit API with project-scoped OAuth tokens stored in Clerk metadata
**Publishing**: Webhook delivery system with retry logic in `webhook_deliveries` table

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
**Webhook delivery**: Monitor `webhook_deliveries` table for failed attempts with retry tracking
**Reddit integration**: Tokens stored as keyed objects in Clerk `privateMetadata`
**AI Model failures**: Check model constants in `src/constants.ts` match provider capabilities

The system prioritizes data security through multi-layer project isolation - always validate project ownership before any database operations.
