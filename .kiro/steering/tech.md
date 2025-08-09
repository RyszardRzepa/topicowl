# Tech Stack

MOST IMPORTANT INSTURCITONS TO FOLLOW:
Think cerfully and only action the specific task I have given to you with most consise and elegant solution that changes as little code as possible.

Dont create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.
Always use ?? insetead of ||.

## Framework & Runtime
- **Next.js 15** with App Router (React 19)
- **TypeScript** with strict mode enabled
- **Node.js** with ES modules

## Database & ORM
- **PostgreSQL** with Drizzle ORM
- **Drizzle Kit** for migrations and schema management
- Schema prefix: `contentbot_*` tables

## Authentication & User Management
- **Clerk** for authentication and user management
- Webhook integration for user lifecycle events

## AI & External APIs
- **Vercel AI SDK** for LLM integration
- **Google Gemini** (primary models: 2.0-flash-exp, 2.5-flash, 2.5-pro)
- **Anthropic Claude** (Sonnet 4)
- **OpenAI GPT** (GPT-5)
- **Unsplash API** for image search and selection

## UI & Styling
- **Tailwind CSS** with custom brand color system
- **Radix UI** components for accessibility
- **Lucide React** for icons
- **MDX Editor** for rich text editing
- **React DnD** for kanban functionality

## Development Tools
- **ESLint** with Next.js config
- **Prettier** with Tailwind plugin
- **TypeScript ESLint** for code quality

## Environment Management
- **T3 Env** for type-safe environment variables
- **Zod** for runtime validation

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Turbo
npm run build           # Production build
npm run start           # Start production server
npm run preview         # Build and start locally

# Database
npm run db:generate     # Generate Drizzle migrations
npm run db:migrate      # Run migrations
npm run db:push         # Push schema changes
npm run db:studio       # Open Drizzle Studio

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run typecheck       # TypeScript type checking
npm run format:check    # Check Prettier formatting
npm run format:write    # Apply Prettier formatting
npm run check           # Run lint + typecheck together
```

## Deployment
- **Vercel** platform optimized
- Environment variables managed through Vercel dashboard
- Automatic deployments on git push