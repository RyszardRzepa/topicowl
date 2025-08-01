# Project Structure & Architecture

## Directory Organization

### Core Application Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (colocated types pattern)
│   ├── dashboard/         # Main application pages
│   ├── onboarding/        # User onboarding flow
│   └── settings/          # User settings pages
├── components/            # React components
│   ├── articles/          # Article-specific components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   └── workflow/         # Workflow management components
├── server/               # Server-side code
│   └── db/              # Database configuration and schema
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
└── styles/              # Global styles and CSS
```

### Database Structure
```
drizzle/
├── migrations/          # SQL migration files
├── meta/               # Migration metadata
├── schema.ts           # Database schema definitions
└── relations.ts        # Table relationships
```

## Architecture Patterns

### API Route Organization
- **Colocated Types**: Request/response types defined alongside route handlers
- **RESTful Structure**: Follows REST conventions with nested resources
- **Route Groups**: Organized by feature (articles, settings, webhooks)

### Component Architecture
- **Feature-based Organization**: Components grouped by domain (articles, workflow, etc.)
- **UI Component Library**: Reusable components in `src/components/ui/`
- **Client/Server Separation**: Clear distinction between client and server components

### Database Schema Pattern
- **Single Schema**: Uses `contentbot` PostgreSQL schema
- **Enum Types**: Status enums for type safety (articleStatusEnum)
- **Audit Fields**: Consistent `createdAt`/`updatedAt` timestamps
- **Public IDs**: Custom nanoid generation for external-facing IDs

## Key Conventions

### File Naming
- **kebab-case** for files and directories
- **PascalCase** for React components
- **camelCase** for functions and variables
- **SCREAMING_SNAKE_CASE** for constants

### Component Patterns
- **Server Components by Default**: Use client components only when needed
- **Props Interface**: Define props interfaces for all components
- **Error Boundaries**: Implement proper error handling
- **Loading States**: Include loading and error states

### API Route Patterns
- **Zod Validation**: Use Zod schemas for request validation
- **Typed Responses**: Define response interfaces for type safety
- **Error Handling**: Consistent error response format
- **Authentication**: Clerk-based auth middleware

### Database Conventions
- **Snake Case**: Database columns use snake_case
- **Timestamps**: All tables include created_at/updated_at
- **Foreign Keys**: Consistent naming with _id suffix
- **JSONB Fields**: Use JSONB for complex data structures

## Workflow States
Articles follow a kanban-style workflow:
- `idea` → `scheduled` → `queued` → `to_generate` → `generating` → `wait_for_publish` → `published`

## Integration Points
- **Clerk Webhooks**: User lifecycle management
- **AI Services**: Research → Outline → Writing pipeline
- **External APIs**: Unsplash (images), YouTube (videos)
- **Webhook Delivery**: Outbound notifications with retry logic