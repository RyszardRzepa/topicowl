# Design Document

## Overview

The article preview page provides a dedicated view for users to review generated articles by clicking on kanban cards. The page displays full article content, metadata, SEO information, and action buttons for content management. The design follows Next.js App Router patterns with server-side rendering for optimal performance and SEO.

## Architecture

### Route Structure
- **Preview Page**: `/articles/[id]` - Dynamic route for individual article preview
- **API Integration**: Leverages existing `/api/articles/[id]` endpoint for data fetching
- **Navigation**: Seamless integration with kanban board for back navigation

### Data Flow
1. User clicks kanban card → Navigate to `/articles/[id]`
2. Server-side data fetching using existing API endpoints
3. Real-time status updates for generating articles using polling or WebSocket
4. Action buttons trigger API calls and update UI state

## Components and Interfaces

### Page Component
```typescript
// src/app/articles/[id]/page.tsx
interface ArticlePreviewPageProps {
  params: { id: string };
}

// Server component that fetches initial data
export default async function ArticlePreviewPage({ params }: ArticlePreviewPageProps)
```

### Client Components

#### ArticlePreview Component
```typescript
// src/components/articles/article-preview.tsx
interface ArticlePreviewProps {
  article: Article;
  onStatusChange: (newStatus: ArticleStatus) => void;
}

// Main preview component with content display and actions
export function ArticlePreview({ article, onStatusChange }: ArticlePreviewProps)
```

#### ArticleActions Component
```typescript
// src/components/articles/article-actions.tsx
interface ArticleActionsProps {
  article: Article;
  onEdit: () => void;
  onRegenerate: () => void;
  onPublish: () => void;
  isLoading: boolean;
}

// Action buttons for article management
export function ArticleActions({ article, onEdit, onRegenerate, onPublish, isLoading }: ArticleActionsProps)
```

#### ArticleMetadata Component
```typescript
// src/components/articles/article-metadata.tsx
interface ArticleMetadataProps {
  article: Article;
  seoData?: SEOAnalysis;
}

// Displays article metadata and SEO information
export function ArticleMetadata({ article, seoData }: ArticleMetadataProps)
```

#### GenerationStatus Component
```typescript
// src/components/articles/generation-status.tsx
interface GenerationStatusProps {
  status: 'generating' | 'completed' | 'failed';
  progress?: number;
  onRetry?: () => void;
}

// Shows generation progress or error states
export function GenerationStatus({ status, progress, onRetry }: GenerationStatusProps)
```

## Data Models

### Extended Article Type
```typescript
// Addition to src/types/types.ts
interface Article {
  // ... existing fields
  seoAnalysis?: SEOAnalysis;
  generationProgress?: number;
  researchSources?: string[];
  wordCount?: number;
  targetKeywords?: string[];
}

interface SEOAnalysis {
  score: number;
  recommendations: string[];
  keywordDensity: Record<string, number>;
  readabilityScore: number;
}
```

### API Response Types
```typescript
// src/app/api/articles/[id]/route.ts
export interface ArticleDetailResponse {
  success: boolean;
  data: Article & {
    seoAnalysis?: SEOAnalysis;
    generationLogs?: GenerationLog[];
  };
}

interface GenerationLog {
  phase: 'research' | 'writing' | 'validation' | 'optimization';
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  details?: string;
}
```

## Error Handling

### Error States
1. **Article Not Found**: Display 404 page with navigation back to kanban
2. **Generation Failed**: Show error message with retry button
3. **Network Errors**: Display toast notifications with retry options
4. **Permission Errors**: Redirect to authentication or show access denied

### Error Boundaries
```typescript
// src/components/articles/article-error-boundary.tsx
interface ArticleErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ComponentType<{ error: Error; retry: () => void }>;
}

// Catches and handles component-level errors
export function ArticleErrorBoundary({ children, fallback }: ArticleErrorBoundaryProps)
```

## Testing Strategy

### Unit Tests
- **Component Testing**: Test each component in isolation using React Testing Library
- **API Route Testing**: Test article detail endpoint with various scenarios
- **Utility Function Testing**: Test formatting, validation, and helper functions

### Integration Tests
- **Page Navigation**: Test navigation from kanban to preview and back
- **Action Workflows**: Test edit, regenerate, and publish flows end-to-end
- **Real-time Updates**: Test generation status polling and UI updates

### E2E Tests
- **User Journey**: Complete flow from kanban click to article preview
- **Responsive Design**: Test on various screen sizes and devices
- **Accessibility**: Test keyboard navigation and screen reader compatibility

### Test Scenarios
```typescript
// Example test cases
describe('Article Preview Page', () => {
  test('displays article content when loaded');
  test('shows generation progress for generating articles');
  test('handles article not found gracefully');
  test('allows editing article content inline');
  test('triggers regeneration with confirmation');
  test('publishes article and updates status');
  test('navigates back to kanban board');
});
```

## Performance Considerations

### Server-Side Rendering
- Initial article data fetched server-side for faster loading
- SEO-friendly with proper meta tags and structured data
- Streaming for large article content

### Client-Side Optimizations
- Lazy loading for non-critical components
- Debounced auto-save for inline editing
- Optimistic updates for better UX

### Caching Strategy
- Server-side caching for article data
- Client-side caching for repeated visits
- Cache invalidation on article updates

## Security Considerations

### Access Control
- Verify user ownership of articles before displaying
- Implement proper authentication checks
- Rate limiting for API endpoints

### Data Validation
- Sanitize article content for XSS prevention
- Validate all user inputs on both client and server
- Implement CSRF protection for state-changing operations

## Mobile Responsiveness

### Responsive Design
- Mobile-first approach with progressive enhancement
- Touch-friendly action buttons and navigation
- Optimized typography for readability on small screens

### Performance on Mobile
- Reduced bundle size for mobile users
- Optimized images and assets
- Efficient data loading strategies

## Accessibility Features

### WCAG Compliance
- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader compatibility

### Visual Accessibility
- High contrast mode support
- Scalable text and UI elements
- Focus indicators for keyboard users
- Alternative text for images and icons