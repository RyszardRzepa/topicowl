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
- **types.ts**: Shared type definitions for API requests/responses
- **design-tokens.ts**: UI design token types for consistency
- **All API endpoints**: Import and export types from `types.ts` for full-stack type safety

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
- **API routes**: `route.ts` in feature folders
- **Types**: Shared types in `src/types/types.ts`
- **Database**: snake_case for table/column names, camelCase for TypeScript

### Code Organization Principles
- **No services layer**: All business logic written directly in API route handlers
- **Inline logic**: Keep related functionality together in the same file
- **Shared types**: Import/export all API types from `src/types/types.ts`
- **Type safety**: Full TypeScript coverage between API and client using shared types

### Database Schema
- **Table prefix**: `content-machine_` for multi-project support
- **ID generation**: Custom nanoid for public IDs
- **Timestamps**: `createdAt` and `updatedAt` with automatic updates
- **Enums**: PostgreSQL enums for status fields

### API Structure
- **RESTful endpoints**: Standard HTTP methods
- **Error handling**: Consistent error responses with status codes
- **Type safety**: Import types from `src/types/types.ts` for requests/responses
- **Self-contained**: All logic written directly in route handlers

### Environment Variables
- **Validation**: T3 Env with Zod schemas
- **Server vs Client**: Clear separation of server-side and client-side variables
- **Required variables**: `DATABASE_URL` for database connection

## Architecture Reference
See `architecture.md` for detailed guidelines on implementing the no-services architecture pattern.
````