# Architecture Guidelines

## Core Principles

### 1. No Services Layer
- **Write code directly in API route handlers** - All business logic belongs in `src/app/api/*/route.ts` files
- **Self-contained endpoints** - Each API route contains all necessary logic inline
- **Direct database access** - API routes interact with database directly using Drizzle ORM
- **No abstraction layers** - Avoid creating service classes or utility functions for business logic

### 2. Shared Type System
- **Central type definitions** - All API request/response types live in `src/types/types.ts`
- **Import types in API routes** - Use shared types for request validation and response formatting
- **Import types in client code** - Use same types for API calls and data handling
- **Full-stack type safety** - Ensure TypeScript compilation catches API contract mismatches

### 3. Code Organization
- **Keep related logic together** - Group functionality within the same file rather than splitting across services
- **Minimize file dependencies** - Reduce imports between business logic files
- **Direct implementation** - Write code inline rather than abstracting into helper functions
- **Clear file purposes** - Each file should have a single, obvious responsibility

## File Structure Examples

### ✅ Good: API Route with Inline Logic
```typescript
// src/app/api/articles/[id]/generate/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { articles } from '@/server/db/schema';
import { ApiResponse, ArticleGenerationRequest } from '@/types/types';

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
  
  return Response.json({ success: true, data: article } as ApiResponse);
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

### ✅ Good: Shared Types Usage
```typescript
// src/app/api/articles/route.ts
import { CreateArticleRequest, ApiResponse, Article } from '@/types/types';

export async function POST(request: NextRequest) {
  const body: CreateArticleRequest = await request.json();
  
  // Implementation here...
  const newArticle: Article = { /* ... */ };
  
  return Response.json({ 
    success: true, 
    data: newArticle 
  } as ApiResponse<Article>);
}
```

```typescript
// src/components/article-form.tsx
import { CreateArticleRequest, Article } from '@/types/types';

async function createArticle(data: CreateArticleRequest): Promise<Article> {
  const response = await fetch('/api/articles', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

## Implementation Checklist

### When Creating New API Endpoints
- [ ] Define request/response types in `src/types/types.ts`
- [ ] Import types in the API route file
- [ ] Write all business logic directly in the route handler
- [ ] Access database directly using Drizzle ORM
- [ ] Handle errors inline without service abstractions

### When Adding Business Logic
- [ ] Write logic directly in the API route where it's needed
- [ ] Avoid creating separate service files
- [ ] Keep related functionality together in the same file
- [ ] Use shared types for data validation and transformation

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
4. **Type Safety** - Direct use of shared types catches errors at compile time
5. **Maintainability** - Changes are localized to single files
6. **Debugging** - Stack traces point directly to business logic location
