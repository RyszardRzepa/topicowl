---
mode: agent
---

# Architecture Guidelines

Never run cli command 'npm run dev'. 
Don't create new files in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.

## Core Principles

### 1. No Services Layer
- **Write code directly in API route handlers** - All business logic belongs in `src/app/api/*/route.ts` files
- **Self-contained endpoints** - Each API route contains all necessary logic inline
- **Direct database access** - API routes interact with database directly using Drizzle ORM
- **No abstraction layers** - Avoid creating service classes or utility functions for business logic

### 2. Colocated Type System
- **API types with routes** - Each API route defines and exports its own request/response types
- **Import types from routes** - Client code imports types directly from API route files
- **Domain types centralized** - Shared domain types (database entities, UI state) live in `src/types/types.ts`
- **Full-stack type safety** - Ensure TypeScript compilation catches API contract mismatches with colocated types

### 3. Code Organization
- **Keep related logic together** - Group functionality within the same file rather than splitting across services
- **Minimize file dependencies** - Reduce imports between business logic files
- **Direct implementation** - Write code inline rather than abstracting into helper functions
- **Clear file purposes** - Each file should have a single, obvious responsibility

### 4. Type Organization Strategy
- **API types colocated** - Request/response types live with their API routes
- **Domain types centralized** - Database entities, business models in `src/types/types.ts`
- **Component types local** - Component-specific props/state types stay in component files
- **Export for reuse** - API routes export types for client consumption

#### Type Location Guidelines:
```typescript
// ✅ Domain types (centralized in src/types/types.ts)
export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  createdAt: Date;
}

// ✅ API types (colocated with routes)
// src/app/api/articles/route.ts
export interface CreateArticleRequest {
  title: string;
  topic: string;
}

// ✅ Component types (local to component)
// src/components/article-form.tsx
interface ArticleFormProps {
  onSubmit: (data: CreateArticleRequest) => void;
  isLoading: boolean;
}
```

## File Structure Examples

### ✅ Good: API Route with Colocated Types
```typescript
// src/app/api/articles/[id]/generate/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { articles } from '@/server/db/schema';

// Types colocated with the API route
export interface ArticleGenerationRequest {
  settings?: {
    tone?: string;
    keywords?: string[];
  };
}

export interface ArticleGenerationResponse {
  success: boolean;
  data: {
    id: string;
    status: 'generating' | 'completed' | 'failed';
    progress?: number;
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const articleId = params.id;
  const body: ArticleGenerationRequest = await request.json();

  // All generation logic here - no service calls
  const article = await db.select().from(articles).where(eq(articles.id, articleId));
  
  // AI generation logic inline
  const research = await fetch('/api/ai-seo-writer/research', {
    method: 'POST',
    body: JSON.stringify({ topic: article.title })
  });
  
  const researchData = await research.json();
  
  // Continue with writing, validation, etc. - all inline
  // ...
  
  return Response.json({ 
    success: true, 
    data: { id: articleId, status: 'generating' } 
  } as ArticleGenerationResponse);
}
```

### ❌ Bad: Using Services Layer
```typescript
// Don't create this pattern
import { ArticleGenerationService } from '@/lib/services/article-generation-service';

export async function POST(request: NextRequest) {
  // Avoid delegating to service classes
  const service = new ArticleGenerationService();
  return service.generateArticle(request);
}
```

### ✅ Good: Colocated Types Usage
```typescript
// src/app/api/articles/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { Article } from '@/types'; // Domain type from central location

// API-specific types colocated with route
export interface CreateArticleRequest {
  title: string;
  topic: string;
  targetKeywords?: string[];
}

export interface CreateArticleResponse {
  success: boolean;
  data: Article;
}

export async function POST(request: NextRequest) {
  const body: CreateArticleRequest = await request.json();
  
  // Implementation here...
  const newArticle: Article = { /* ... */ };
  
  return Response.json({ 
    success: true, 
    data: newArticle 
  } as CreateArticleResponse);
}
```

```typescript
// src/components/article-form.tsx
import { CreateArticleRequest, CreateArticleResponse } from '@/app/api/articles/route';

async function createArticle(data: CreateArticleRequest): Promise<CreateArticleResponse> {
  const response = await fetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

## Implementation Checklist

### When Creating New API Endpoints
- [ ] Define request/response types colocated in the API route file
- [ ] Export types for client consumption
- [ ] Use domain types from `src/types/types.ts` for shared entities
- [ ] Write all business logic directly in the route handler
- [ ] Access database directly using Drizzle ORM
- [ ] Handle errors inline without service abstractions

### When Adding Business Logic
- [ ] Write logic directly in the API route where it's needed
- [ ] Avoid creating separate service files
- [ ] Keep related functionality together in the same file
- [ ] Use colocated types for data validation and transformation
- [ ] Import domain types from `src/types/types.ts` when needed

### When Working with Database
- [ ] Import database instance directly: `import { db } from '@/server/db'`
- [ ] Write queries inline in the API route
- [ ] Don't create repository or DAO patterns
- [ ] Use Drizzle schema types for type safety

### When Handling AI Operations
- [ ] Call AI APIs directly from route handlers
- [ ] Don't abstract AI logic into separate services
- [ ] Keep prompt logic in the same file where it's used
- [ ] Handle AI responses and errors inline

## Benefits of This Architecture

1. **Simplicity** - Easier to understand and debug when logic is co-located
2. **Transparency** - Clear data flow without abstraction layers
3. **Performance** - Fewer function calls and file imports
4. **Type Safety** - Colocated types provide immediate feedback and are easier to maintain
5. **Maintainability** - Changes are localized to single files, including their types
6. **Debugging** - Stack traces point directly to business logic location
7. **Colocation** - Types live next to their usage, making the code more cohesive

---
mode: agent
---

# Product Overview

## AI SEO Content Machine

An automated content creation platform that uses multi-agent AI systems to generate, manage, and publish SEO-optimized articles at scale.

### Core Features

- **Kanban-based Article Management**: Visual workflow with columns for Ideas, To Generate, Generating, Wait for Publish, and Published
- **Multi-Agent Content Generation**: AI agents handle research, writing, fact-checking, SEO optimization, and internal linking directly within API endpoints
- **Automated Publishing**: Scheduled article publishing with cron job automation
- **SEO Optimization**: Built-in keyword research, competitor analysis, and search engine optimization

### Architecture Highlights

- **Self-contained API endpoints**: All business logic written directly in route handlers
- **Type-safe communication**: Shared types between API and client via `src/types/types.ts`
- **Direct database interaction**: No abstraction layers, API routes use Drizzle ORM directly
- **Inline AI orchestration**: Multi-agent workflows implemented directly in API endpoints

### Target Users

Content marketers, SEO specialists, and businesses looking to scale their content production while maintaining quality and search engine visibility.

### Key Value Proposition

Transform content ideas into published, SEO-optimized articles through automated multi-agent workflows, reducing manual effort while maintaining editorial control through an intuitive kanban interface.
```

---
mode: agent
---

# Project Structure

## Root Directory
- **Configuration files**: `next.config.js`, `drizzle.config.ts`, `tsconfig.json`, `eslint.config.js`, `prettier.config.js`
- **Environment**: `.env`, `.env.example` for environment variables
- **Database**: `drizzle/` folder contains migrations and metadata

## Source Code Organization (`src/`)

### App Router Structure (`src/app/`)
- **Root layout**: `layout.tsx` - Global app layout and metadata
- **Home page**: `page.tsx` - Main application entry point
- **API routes**: `api/` - RESTful endpoints organized by feature

````markdown
# Project Structure

## Root Directory
- **Configuration files**: `next.config.js`, `drizzle.config.ts`, `tsconfig.json`, `eslint.config.js`, `prettier.config.js`
- **Environment**: `.env`, `.env.example` for environment variables
- **Database**: `drizzle/` folder contains migrations and metadata
- **Scripts**: `start-database.sh` for local database setup

## Source Code Organization (`src/`)

### App Router Structure (`src/app/`)
- **Root layout**: `layout.tsx` - Global app layout and metadata
- **Home page**: `page.tsx` - Main application entry point
- **API routes**: `api/` - RESTful endpoints organized by feature

### API Route Organization (`src/app/api/`)
```
api/
├── ai-seo-writer/          # Multi-agent content generation system
│   ├── research/           # Research phase endpoint
│   ├── write/              # Content writing endpoint
│   ├── validate/           # Content validation endpoint
│   ├── update/             # Content update endpoint
│   └── schedule/           # Article scheduling endpoint
├── articles/               # Article management
│   └── [id]/              # Dynamic article routes
│       ├── generate/       # Trigger article generation
│       ├── generation-status/ # Check generation progress
│       └── schedule/       # Schedule article publishing
├── kanban/                # Kanban board management
│   ├── board/             # Get kanban board state
│   ├── articles/          # Article CRUD operations
│   └── move-article/      # Handle drag-and-drop
└── cron/                  # Scheduled tasks
    └── publish-articles/   # Automated publishing cron job
```

### Components (`src/components/`)
- **UI components**: `ui/` - Reusable UI components (buttons, cards, badges)
- **Feature components**: `kanban/` - Kanban board implementation
- **Component naming**: kebab-case with `.tsx` extension

### Types (`src/types/`)
- **types.ts**: Shared domain types and common interfaces (e.g., database entities, UI state)
- **design-tokens.ts**: UI design token types for consistency
- **API types**: Each API route defines and exports its own request/response types for colocation

### Database Layer (`src/server/`)
- **Database connection**: `db/index.ts` - Drizzle database instance
- **Schema definition**: `db/schema.ts` - All database tables and types
- **Schema organization**: Uses `contentMachineSchema` namespace for multi-project support

### Utilities (`src/lib/`)
- **prompts.ts**: AI prompt templates - contains all prompt logic inline
- **utils.ts**: Only essential shared utilities (no business logic)
- **sitemap.ts**: SEO sitemap generation - contains all sitemap logic inline

### Components (`src/components/`)
- **UI components**: `ui/` - Reusable UI components (buttons, cards, badges)
- **Feature components**: `kanban/` - Kanban board implementation
- **Component naming**: kebab-case with `.tsx` extension

### Services Layer (`src/lib/services/`)
- **article-generation-service.ts**: Orchestrates multi-agent content generation
- **research-service.ts**: Handles content research phase
- **writing-service.ts**: Manages AI content writing
- **validation-service.ts**: Fact-checking and content validation
- **update-service.ts**: Content correction and updates
- **scheduling-service.ts**: Article scheduling logic

### Database Layer (`src/server/`)
- **Database connection**: `db/index.ts` - Drizzle database instance
- **Schema definition**: `db/schema.ts` - All database tables and types
- **Schema organization**: Uses `contentMachineSchema` namespace for multi-project support

### Utilities (`src/lib/`)
- **prompts.ts**: AI prompt templates
- **utils.ts**: General utility functions
- **sitemap.ts**: SEO sitemap generation

## Key Conventions

### File Naming
- **Components**: kebab-case (e.g., `kanban-board.tsx`)
- **API routes**: `route.ts` in feature folders with colocated types
- **Types**: Domain types in `src/types/types.ts`, API types colocated with routes
- **Database**: snake_case for table/column names, camelCase for TypeScript

### Code Organization Principles
- **No services layer**: All business logic written directly in API route handlers
- **Inline logic**: Keep related functionality together in the same file
- **Colocated types**: Each API route defines and exports its own request/response types
- **Type safety**: Full TypeScript coverage with types colocated near their usage

### Database Schema
- **Table prefix**: `content-machine_` for multi-project support
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

---
mode: agent
---

# Technology Stack

## Framework & Runtime
- **Next.js 15** with App Router architecture
- **React 19** with TypeScript
- **Node.js** runtime environment

## Database & ORM
- **PostgreSQL** database
- **Drizzle ORM** with schema-based migrations
- **Drizzle Kit** for database management

## AI & External Services
- **Vercel AI SDK** for AI model integration
- **Google Gemini 2.0 Flash** for research and grounding
- **Claude 3.5 Sonnet** for content writing
- **Anthropic AI SDK** and **Google AI SDK**

## Styling & UI
- **Tailwind CSS 4.0** for styling
- **Lucide React** for icons
- **DND Kit** and **Hello Pangea DND** for drag-and-drop functionality

## Development Tools
- **TypeScript** with strict type checking
- **ESLint** with Next.js config and Drizzle plugin
- **Prettier** with Tailwind plugin for code formatting
- **T3 Env** for environment variable validation with Zod

## Architecture Principles
- **No services layer**: All business logic written directly in API route handlers
- **Shared types**: Central type definitions in `src/types/types.ts` for API/client type safety
- **Self-contained endpoints**: Each API route contains all necessary logic inline
- **Direct database access**: API routes interact with database directly using Drizzle ORM

## Common Commands

### Development
```bash
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and start production server
```

### Database
```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run database migrations
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio
```

### Code Quality
```bash
npm run check        # Run linting and type checking
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # Run TypeScript type checking
npm run format:check # Check code formatting
npm run format:write # Format code with Prettier
```

### Database Setup
```bash
./start-database.sh  # Start local PostgreSQL database
```

## Build Configuration
- **ESLint and TypeScript errors ignored during builds** (configured in next.config.js)
- **Environment validation** can be skipped with `SKIP_ENV_VALIDATION=true`
- **Turbo mode** enabled for faster development builds