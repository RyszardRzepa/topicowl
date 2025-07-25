# Technology Stack

Never run cli command 'npm run dev'. 
Don't create new files in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.

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
