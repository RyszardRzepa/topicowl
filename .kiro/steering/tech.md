# Technology Stack

## Framework & Runtime
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment

## Database & ORM
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe database toolkit
- **Drizzle Kit** - Database migrations and introspection

## Authentication & User Management
- **Clerk** - Authentication and user management service
- **Clerk Webhooks** - User lifecycle event handling

## API & Data Fetching
- **tRPC** - End-to-end typesafe APIs
- **TanStack Query** - Server state management
- **Apollo.io API** - Company and contact data source
- **Google Gemini AI** - Buying intent analysis with grounding
- **Vercel AI SDK** - AI integration toolkit

## Styling & UI
- **Tailwind CSS v4** - Utility-first CSS framework
- **Radix UI** - Headless UI components
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **Geist Font** - Typography

## Development Tools
- **ESLint** - Code linting with Next.js config
- **Prettier** - Code formatting with Tailwind plugin
- **TypeScript ESLint** - TypeScript-specific linting

## Environment & Deployment
- **T3 Env** - Environment variable validation
- **Zod** - Runtime type validation

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # TypeScript type checking
npm run check        # Run lint + typecheck
npm run format:check # Check Prettier formatting
npm run format:write # Apply Prettier formatting
```

### Database
```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run database migrations
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## Key Dependencies
- **@clerk/nextjs** - Clerk authentication
- **@trpc/server** & **@trpc/client** - tRPC API layer
- **drizzle-orm** - Database ORM
- **@ai-sdk/google** - Google AI integration
- **postgres** - PostgreSQL client
- **zod** - Schema validation