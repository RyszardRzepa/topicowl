---
mode: agent
---

# Product Overview

## AI SEO Content Machine

An automated content creation platform that uses multi-agent AI systems to generate, manage, and publish SEO-optimized articles at scale.

### Core Features

- **Kanban-based Article Management**: Visual workflow with columns for Ideas, To Generate, Generating, Wait for Publish, and Published
- **Multi-Agent Content Generation**: AI agents handle research, writing, fact-checking, SEO optimization, and internal linking directly within API endpoints
- **Automated Publishing**: Scheduled article publishing with cron job automation
- **SEO Optimization**: Built-in keyword research, competitor analysis, and search engine optimization

### Architecture Highlights

- **Self-contained API endpoints**: All business logic written directly in route handlers
- **Type-safe communication**: Shared types between API and client via `src/types/types.ts`
- **Direct database interaction**: No abstraction layers, API routes use Drizzle ORM directly
- **Inline AI orchestration**: Multi-agent workflows implemented directly in API endpoints

### Target Users

Content marketers, SEO specialists, and businesses looking to scale their content production while maintaining quality and search engine visibility.

### Key Value Proposition

Transform content ideas into published, SEO-optimized articles through automated multi-agent workflows, reducing manual effort while maintaining editorial control through an intuitive kanban interface.
```