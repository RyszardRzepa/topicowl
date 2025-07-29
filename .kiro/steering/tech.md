# Technology Stack
Never run cli command 'npm run dev'. 
Don't create new files in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.
Always use ?? instead ||.

## Framework & Runtime
- **Next.js 15** with App Router (React 19)
- **TypeScript** for type safety
- **Node.js** runtime environment

## Database & ORM
- **PostgreSQL** database
- **Drizzle ORM** with schema-based migrations
- **Drizzle Kit** for database management

## Authentication & User Management
- **Clerk** for authentication and user management
- Webhook-based user lifecycle management

## AI & External APIs
- **Google Gemini API** for content generation
- **Anthropic Claude API** for content generation  
- **Vercel AI SDK** for AI integration
- **Unsplash API** for image sourcing

## Styling & UI
- **Tailwind CSS** with custom Notion-inspired design system
- **Radix UI** components for accessibility
- **Lucide React** for icons
- **shadcn/ui** component patterns

## Development Tools
- **ESLint** with Next.js config and Drizzle plugin
- **Prettier** with Tailwind plugin for code formatting
- **TypeScript** strict mode enabled

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
npm run db:push      # Push schema changes directly
npm run db:studio    # Open Drizzle Studio
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # Run TypeScript compiler check
npm run check        # Run both lint and typecheck
npm run format:check # Check Prettier formatting
npm run format:write # Apply Prettier formatting
```

## Environment Configuration
- Uses `@t3-oss/env-nextjs` for type-safe environment variables
- Separate server/client environment validation
- Required: Database URL, AI API keys, Clerk keys, Unsplash keys