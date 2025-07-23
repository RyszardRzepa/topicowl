# Project Structure

## Root Directory
- **`.env`** - Environment variables (local)
- **`.env.example`** - Environment variable template
- **`package.json`** - Dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration
- **`drizzle.config.ts`** - Database configuration
- **`next.config.js`** - Next.js configuration
- **`components.json`** - shadcn/ui component configuration

## Source Code (`src/`)

### Application Routes (`src/app/`)
```
src/app/
├── layout.tsx              # Root layout with providers
├── page.tsx               # Landing page
├── api/                   # API routes
│   ├── trpc/[trpc]/       # tRPC API handler
│   └── webhooks/          # External service webhooks
├── dashboard/             # Main application
│   ├── layout.tsx         # Dashboard layout with navigation
│   ├── page.tsx          # Dashboard home
│   ├── search/           # Company/contact search
│   ├── prospect-lists/   # Lead management
│   └── settings/         # User settings
├── onboarding/           # User onboarding flow
└── pricing/              # Pricing page
```

### Components (`src/components/`)
- **`ui/`** - Reusable UI components (buttons, forms, etc.)
- **Feature components** - Page-specific components (search, navigation, etc.)

### Server Logic (`src/server/`)
```
src/server/
├── api/
│   ├── root.ts           # Main tRPC router
│   ├── trpc.ts          # tRPC configuration
│   └── routers/         # Feature-specific API routes
│       ├── company.ts    # Company search & management
│       ├── contacts.ts   # Contact operations
│       ├── buying-intent.ts # AI buying intent analysis
│       ├── credits.ts    # Credit system
│       └── prospect-list.ts # Lead list management
└── db/
    ├── index.ts         # Database connection
    └── schema.ts        # Drizzle schema definitions
```

### Client-Side (`src/`)
- **`trpc/`** - tRPC client configuration
- **`lib/`** - Utility functions and services
- **`types.ts`** - Shared TypeScript types
- **`constants.ts`** - Application constants
- **`middleware.ts`** - Next.js middleware (auth)

## Database (`drizzle/`)
- **Migration files** - Numbered SQL migration files
- **`meta/`** - Drizzle metadata and snapshots

## Key Patterns

### Database Schema
- **PostgreSQL schema**: `prospects` namespace
- **Tables**: users, companies, contacts, searches, credits, etc.
- **JSONB fields** for flexible data (technologies, filters, AI results)
- **Comprehensive indexing** for search performance

### API Architecture
- **tRPC routers** organized by feature domain
- **Zod validation** for all inputs/outputs
- **Type-safe** end-to-end from database to frontend
- **Credit system integration** across all paid operations

### Authentication Flow
- **Clerk** handles auth, user management, webhooks
- **Middleware** protects dashboard routes
- **User context** available in all tRPC procedures

### UI Patterns
- **Tailwind CSS** for styling with design system tokens
- **Radix UI** for accessible component primitives  
- **Responsive design** with mobile-first approach
- **Loading states** and error boundaries throughout

### File Naming
- **kebab-case** for files and directories
- **PascalCase** for React components
- **camelCase** for functions and variables
- **SCREAMING_SNAKE_CASE** for constants