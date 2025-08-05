---
applyTo: "**"             
description: Global repo standards
---
# Tech Stack

## Framework & Runtime
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment

## Database & ORM
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe database toolkit
- **Drizzle Kit** - Database migrations and tooling

## Authentication & User Management
- **Clerk** - Authentication and user management platform

## AI & Content Generation
- **AI SDK** - Vercel's AI SDK for LLM integration
- **Anthropic Claude** - Primary AI model
- **Google Generative AI** - Secondary AI model

## UI & Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **Radix UI** - Headless UI components
- **Lucide React** - Icon library
- **Lexical** - Rich text editor framework
- **Sonner** - Toast notifications

## Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript ESLint** - TypeScript-specific linting

## Common Commands

### Development
```bash
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and start production server
```

### Code Quality
```bash
npm run check        # Run linting and type checking
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run typecheck    # Run TypeScript type checking
npm run format:check # Check code formatting
npm run format:write # Format code with Prettier
```

### Database
```bash
npm run db:generate  # Generate database migrations
npm run db:migrate   # Run database migrations
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## Environment Configuration
- Uses `@t3-oss/env-nextjs` for type-safe environment variables
- Environment variables are validated with Zod schemas
- Separate client and server environment variable validation