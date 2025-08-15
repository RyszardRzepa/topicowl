# Tech Stack

MOST IMPORTANT INSTRUCTIONS TO FOLLOW:
Think carefully and only action the specific task I have given to you with most concise and elegant solution that changes as little code as possible.

Don't create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types.ts` and colocated types in the API route files.
Don't create scripts files for testing.
Always use ?? instead of ||.

Make sure that we don't create new util functions, we should inline code where it is used.

## Framework & Runtime
- **Next.js 15.2.3** with App Router (React 19)
- **TypeScript 5.8.2** with strict mode enabled
- **Node.js** with ES modules

## Database & ORM
- **PostgreSQL** with Drizzle ORM 0.41.0
- **Drizzle Kit 0.30.5** for migrations and schema management
- Schema: `contentbot` schema with prefixed tables
- Multi-project support with project-based data isolation

## Authentication & User Management
- **Clerk 6.25.4** for authentication and user management
- **Svix 1.69.0** for webhook signature verification
- Webhook integration for user lifecycle events

## AI & External APIs
- **Vercel AI SDK 5.0.4** for LLM integration
- **Google Gemini** via @ai-sdk/google 2.0.2 (primary models: 2.0-flash-exp, 2.5-flash, 2.5-pro)
- **Google Vertex AI** via @ai-sdk/google-vertex 3.0.3
- **Anthropic Claude** via @ai-sdk/anthropic 2.0.1 (Sonnet 4)
- **OpenAI GPT** via @ai-sdk/openai 2.0.7 (GPT-5)
- **Unsplash API** for image search and selection
- **Reddit API** integration for content research

## UI & Styling
- **Tailwind CSS 4.0.15** with custom brand color system
- **Radix UI** components for accessibility
- **Lucide React 0.525.0** for icons
- **MDXEditor 3.40.1** for rich text editing
- **Hello Pangea DnD 18.0.1** for kanban functionality
- **React Day Picker 9.8.1** for date selection
- **Sonner 2.0.6** for toast notifications

## Development Tools
- **ESLint 9.23.0** with Next.js config
- **Prettier 3.5.3** with Tailwind plugin
- **TypeScript ESLint 8.27.0** for code quality
- **TSX 4.20.3** for TypeScript execution

## Environment Management
- **T3 Env 0.12.0** for type-safe environment variables
- **Zod 3.24.2** for runtime validation

## Content Processing
- **React Markdown 10.1.0** for markdown rendering
- **Remark GFM 4.0.1** for GitHub Flavored Markdown
- **Remark Breaks 4.0.0** for line break handling
- **Rehype Highlight 7.0.2** for syntax highlighting

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
- **Vercel Functions 2.2.5** for serverless functions
- Environment variables managed through Vercel dashboard
- Automatic deployments on git push