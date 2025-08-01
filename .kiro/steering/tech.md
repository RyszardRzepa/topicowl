# Technology Stack & Development Guide

## Core Technologies

### Framework & Runtime
- **Next.js 15** with App Router (React 19)
- **TypeScript** for type safety
- **Node.js** runtime environment

### Database & ORM
- **PostgreSQL** database
- **Drizzle ORM** for database operations
- **Drizzle Kit** for migrations and schema management

### Authentication & User Management
- **Clerk** for authentication and user management
- Webhook-based user lifecycle management

### AI & Content Generation
- **Anthropic Claude** (via @ai-sdk/anthropic) for content writing
- **Google Gemini** (via @ai-sdk/google) for research and analysis
- **Vercel AI SDK** for AI integration

### UI & Styling
- **Tailwind CSS** for styling with custom Notion-inspired design system
- **Radix UI** components for accessible UI primitives
- **Lexical Editor** for rich text editing
- **Lucide React** for icons

### External Integrations
- **Unsplash API** for cover images
- **YouTube API** for video integration (max 1 video per article)
- **Webhook system** for external notifications

## Common Commands

### Development
```bash
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and start production server
```

### Database Operations
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Run pending migrations
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

## Build System
- **Package Manager**: npm (v10.8.2)
- **Build Tool**: Next.js with Turbo for development
- **Deployment**: Vercel (configured via vercel.json)
- **Environment**: T3 Stack architecture pattern