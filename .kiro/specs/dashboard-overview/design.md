# Design Document

## Overview

The dashboard overview will be implemented as the main landing page at `/dashboard`, replacing or enhancing the current workflow dashboard. It will provide a comprehensive view of both article generation and Reddit task metrics through a clean, card-based interface that adapts to different screen sizes and connection states.

## Architecture

### Component Structure
```
DashboardOverview (page component)
├── ArticleMetricsSection
│   ├── ArticleStatsCard
│   ├── WorkflowStatusCard
│   └── RecentActivityCard
├── RedditMetricsSection (conditional)
│   ├── RedditStatsCard
│   ├── WeeklyProgressCard
│   └── UpcomingTasksCard
├── RedditIntegrationCard (when not connected)
└── QuickActionsSection
    ├── ArticleQuickActions
    └── RedditQuickActions (conditional)
```

### Data Flow
1. **Initial Load**: Single API call to fetch all dashboard statistics
2. **Unified Response**: Article metrics and Reddit data returned together
3. **Reddit Status**: API handles Reddit connection check internally
4. **Error Handling**: Single error state for the entire dashboard
5. **Loading States**: Single loading state with skeleton components

## Components and Interfaces

### 1. DashboardOverview Component
**Location**: `src/app/dashboard/page.tsx`
- Main page component that orchestrates all dashboard sections
- Manages overall loading and error states
- Handles responsive layout switching

### 2. ArticleMetricsSection Component
**Location**: `src/components/dashboard/article-metrics-section.tsx`
- Displays article generation statistics and workflow status
- Uses existing `useWorkflowArticles` hook for data consistency
- Shows credit balance and usage information

### 3. RedditMetricsSection Component  
**Location**: `src/components/dashboard/reddit-metrics-section.tsx`
- Displays Reddit task statistics and performance metrics
- Conditionally rendered based on Reddit connection status
- Shows weekly progress and upcoming tasks

### 4. RedditIntegrationCard Component
**Location**: `src/components/dashboard/reddit-integration-card.tsx`
- Shown when Reddit is not connected
- Displays benefits and connection call-to-action
- Handles OAuth initiation

### 5. QuickActionsSection Component
**Location**: `src/components/dashboard/quick-actions-section.tsx`
- Provides navigation shortcuts to key features
- Adapts actions based on Reddit connection status
- Uses existing button components for consistency

## Data Models

### Article Metrics Interface
```typescript
interface ArticleMetrics {
  totalThisMonth: number;
  publishedLastWeek: number;
  workflowCounts: {
    planning: number;
    generating: number;
    publishing: number;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    action: 'created' | 'generated' | 'published';
    timestamp: string;
  }>;
  credits: {
    balance: number;
    usedThisMonth: number;
  };
}
```

### Reddit Metrics Interface
```typescript
interface RedditMetrics {
  weeklyStats: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    karmaEarned: number;
  };
  todaysPendingTasks: number;
  upcomingTasks: Array<{
    id: number;
    title: string;
    subreddit: string;
    scheduledDate: string;
  }>;
}
```

### Dashboard Stats Response Interface
```typescript
interface DashboardStatsResponse {
  articles: ArticleMetrics;
  reddit: {
    connected: boolean;
    data: RedditMetrics | null;
  };
}

interface DashboardState {
  data: DashboardStatsResponse | null;
  loading: boolean;
  error: string | null;
}
```

## API Endpoints

### Dashboard Stats Endpoint
**Endpoint**: `GET /api/dashboard/stats`
- Returns all dashboard statistics in a single request
- Includes both article metrics and Reddit metrics (when connected)
- Handles Reddit connection status internally and returns appropriate data structure
- Uses existing article and Reddit queries with dashboard-specific aggregations
- Empty data handled by returning 0 counts and empty arrays that client checks

## Error Handling

### Unified Error Handling
- Single error state for the entire dashboard API call
- If Reddit data fails, API returns reddit.connected: false with null data
- Article data is always returned unless there's a critical system error
- Retry mechanism available for the entire dashboard

### Graceful Degradation
- Dashboard shows article data even if Reddit integration fails
- Reddit section gracefully hidden when reddit.connected is false
- Partial data scenarios handled within the single API response

### Error States
- Network errors: Show retry button with error message
- No data: Show empty state with helpful guidance
- Permission errors: Show appropriate access messages

### Empty Data States
- **No Articles**: Check `totalThisMonth === 0` and `recentActivity.length === 0` to show onboarding card
- **No Reddit Connection**: Show Reddit integration card with connection benefits
- **Reddit Connected but No Settings**: Check if Reddit data is null despite being connected to show settings configuration prompt
- **Reddit Settings but No Tasks**: Check `weeklyStats.totalTasks === 0` to show "Generate your first tasks" call-to-action
- **Partial Data**: Show available metrics and empty states for missing sections based on data checks

## Testing Strategy

### Unit Tests
- Test each dashboard component in isolation
- Mock API responses for different data scenarios
- Test error handling and loading states
- Verify responsive behavior with different screen sizes

### Integration Tests
- Test data flow between components and hooks
- Verify API endpoint responses and error handling
- Test Reddit connection state changes
- Verify navigation and quick actions functionality

### User Acceptance Tests
- Test complete dashboard loading experience
- Verify metrics accuracy against actual data
- Test responsive design on different devices
- Verify accessibility compliance (WCAG 2.1 AA)

## Performance Considerations

### Data Fetching
- Parallel API calls for article and Reddit data
- Implement caching for frequently accessed metrics
- Use React Query or SWR for data synchronization
- Debounce refresh actions to prevent excessive API calls

### Rendering Optimization
- Use React.memo for metric cards to prevent unnecessary re-renders
- Implement skeleton loading states for better perceived performance
- Lazy load non-critical components below the fold
- Optimize bundle size by code-splitting dashboard components

### Responsive Design
- Mobile-first approach with progressive enhancement
- Use CSS Grid for flexible layout adaptation
- Implement touch-friendly interactions for mobile devices
- Ensure fast loading on slower mobile connections