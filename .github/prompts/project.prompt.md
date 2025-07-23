---
mode: agent
---
# Product Overview

## AI SEO Content Machine

An automated content creation platform that uses multi-agent AI systems to generate, manage, and publish SEO-optimized articles at scale.

### Core Features

- **Kanban-based Article Management**: Visual workflow with columns for Ideas, To Generate, Generating, Wait for Publish, and Published
- **Multi-Agent Content Generation**: Coordinated AI agents handle research, writing, fact-checking, SEO optimization, and internal linking
- **Automated Publishing**: Scheduled article publishing with cron job automation
- **SEO Optimization**: Built-in keyword research, competitor analysis, and search engine optimization

### Target Users

Content marketers, SEO specialists, and businesses looking to scale their content production while maintaining quality and search engine visibility.

### Key Value Proposition

Transform content ideas into published, SEO-optimized articles through automated multi-agent workflows, reducing manual effort while maintaining editorial control through an intuitive kanban interface.

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
- **Services**: kebab-case with service suffix
- **Database**: snake_case for table/column names, camelCase for TypeScript

### Database Schema
- **Table prefix**: `content-machine_` for multi-project support
- **ID generation**: Custom nanoid for public IDs
- **Timestamps**: `createdAt` and `updatedAt` with automatic updates
- **Enums**: PostgreSQL enums for status fields

### API Structure
- **RESTful endpoints**: Standard HTTP methods
- **Error handling**: Consistent error responses with status codes
- **Type safety**: Full TypeScript coverage for requests/responses

### Environment Variables
- **Validation**: T3 Env with Zod schemas
- **Server vs Client**: Clear separation of server-side and client-side variables
- **Required variables**: `DATABASE_URL` for database connection

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