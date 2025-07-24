# Architecture Guidelines

## Core Principles

### 1. No Services Layer
- **Write code directly in API route handlers** - All business logic belongs in `src/app/api/*/route.ts` files
- **Self-contained endpoints** - Each API route contains all necessary logic inline
- **Direct database access** - API routes interact with database directly using Drizzle ORM
- **No abstraction layers** - Avoid creating service classes or utility functions for business logic

### 2. Colocated Type System
- **API types with routes** - Each API route defines and exports its own request/response types
- **Import types from routes** - Client code imports types directly from API route files
- **Domain types centralized** - Shared domain types (database entities, UI state) live in `src/types/types.ts`
- **Full-stack type safety** - Ensure TypeScript compilation catches API contract mismatches with colocated types

### 3. Code Organization
- **Keep related logic together** - Group functionality within the same file rather than splitting across services
- **Minimize file dependencies** - Reduce imports between business logic files
- **Direct implementation** - Write code inline rather than abstracting into helper functions
- **Clear file purposes** - Each file should have a single, obvious responsibility

### 4. Type Organization Strategy
- **API types colocated** - Request/response types live with their API routes
- **Domain types centralized** - Database entities, business models in `src/types/types.ts`
- **Component types local** - Component-specific props/state types stay in component files
- **Export for reuse** - API routes export types for client consumption

#### Type Location Guidelines:
```typescript
// ✅ Domain types (centralized in src/types/types.ts)
export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  createdAt: Date;
}

// ✅ API types (colocated with routes)
// src/app/api/articles/route.ts
export interface CreateArticleRequest {
  title: string;
  topic: string;
}

// ✅ Component types (local to component)
// src/components/article-form.tsx
interface ArticleFormProps {
  onSubmit: (data: CreateArticleRequest) => void;
  isLoading: boolean;
}
```

## File Structure Examples

### ✅ Good: API Route with Colocated Types
```typescript
// src/app/api/articles/[id]/generate/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { articles } from '@/server/db/schema';

// Types colocated with the API route
export interface ArticleGenerationRequest {
  settings?: {
    tone?: string;
    keywords?: string[];
  };
}

export interface ArticleGenerationResponse {
  success: boolean;
  data: {
    id: string;
    status: 'generating' | 'completed' | 'failed';
    progress?: number;
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const articleId = params.id;
  const body: ArticleGenerationRequest = await request.json();

  // All generation logic here - no service calls
  const article = await db.select().from(articles).where(eq(articles.id, articleId));
  
  // AI generation logic inline
  const research = await fetch('/api/ai-seo-writer/research', {
    method: 'POST',
    body: JSON.stringify({ topic: article.title })
  });
  
  const researchData = await research.json();
  
  // Continue with writing, validation, etc. - all inline
  // ...
  
  return Response.json({ 
    success: true, 
    data: { id: articleId, status: 'generating' } 
  } as ArticleGenerationResponse);
}
```

### ❌ Bad: Using Services Layer
```typescript
// Don't create this pattern
import { ArticleGenerationService } from '@/lib/services/article-generation-service';

export async function POST(request: NextRequest) {
  // Avoid delegating to service classes
  const service = new ArticleGenerationService();
  return service.generateArticle(request);
}
```

### ✅ Good: Colocated Types Usage
```typescript
// src/app/api/articles/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { Article } from '@/types'; // Domain type from central location

// API-specific types colocated with route
export interface CreateArticleRequest {
  title: string;
  topic: string;
  targetKeywords?: string[];
}

export interface CreateArticleResponse {
  success: boolean;
  data: Article;
}

export async function POST(request: NextRequest) {
  const body: CreateArticleRequest = await request.json();
  
  // Implementation here...
  const newArticle: Article = { /* ... */ };
  
  return Response.json({ 
    success: true, 
    data: newArticle 
  } as CreateArticleResponse);
}
```

```typescript
// src/components/article-form.tsx
import { CreateArticleRequest, CreateArticleResponse } from '@/app/api/articles/route';

async function createArticle(data: CreateArticleRequest): Promise<CreateArticleResponse> {
  const response = await fetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

## Implementation Checklist

### When Creating New API Endpoints
- [ ] Define request/response types colocated in the API route file
- [ ] Export types for client consumption
- [ ] Use domain types from `src/types/types.ts` for shared entities
- [ ] Write all business logic directly in the route handler
- [ ] Access database directly using Drizzle ORM
- [ ] Handle errors inline without service abstractions

### When Adding Business Logic
- [ ] Write logic directly in the API route where it's needed
- [ ] Avoid creating separate service files
- [ ] Keep related functionality together in the same file
- [ ] Use colocated types for data validation and transformation
- [ ] Import domain types from `src/types/types.ts` when needed

### When Working with Database
- [ ] Import database instance directly: `import { db } from '@/server/db'`
- [ ] Write queries inline in the API route
- [ ] Don't create repository or DAO patterns
- [ ] Use Drizzle schema types for type safety

### When Handling AI Operations
- [ ] Call AI APIs directly from route handlers
- [ ] Don't abstract AI logic into separate services
- [ ] Keep prompt logic in the same file where it's used
- [ ] Handle AI responses and errors inline

## Benefits of This Architecture

1. **Simplicity** - Easier to understand and debug when logic is co-located
2. **Transparency** - Clear data flow without abstraction layers
3. **Performance** - Fewer function calls and file imports
4. **Type Safety** - Colocated types provide immediate feedback and are easier to maintain
5. **Maintainability** - Changes are localized to single files, including their types
6. **Debugging** - Stack traces point directly to business logic location
7. **Colocation** - Types live next to their usage, making the code more cohesive
