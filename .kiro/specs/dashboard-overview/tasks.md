# Implementation Plan

- [x] 1. Create unified dashboard stats API endpoint
  - Create `/api/dashboard/stats` endpoint to fetch all dashboard statistics in one request
  - Aggregate both article statistics and Reddit task statistics
  - Handle Reddit connection status internally and return appropriate data structure
  - Implement proper error handling and project-based data isolation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Implement dashboard data types and interfaces
  - Define ArticleMetrics interface in `src/types.ts`
  - Define RedditMetrics interface in `src/types.ts`
  - Define DashboardStatsResponse interface in `src/types.ts`
  - Define DashboardState interface in `src/types.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [-] 3. Create article metrics section components
  - Implement ArticleStatsCard component showing monthly totals and weekly published count
  - Implement WorkflowStatusCard component showing planning/generating/publishing counts
  - Implement RecentActivityCard component showing recent article actions
  - Create ArticleMetricsSection wrapper component with empty state handling
  - Add ArticleEmptyState component for users with no articles
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 4. Create Reddit metrics section components
  - Implement RedditStatsCard component showing weekly completion stats and karma
  - Implement WeeklyProgressCard component showing completion rate visualization
  - Implement UpcomingTasksCard component showing next 3 days of tasks
  - Create RedditMetricsSection wrapper component with conditional rendering
  - Add RedditEmptyState component for users with no Reddit tasks
  - Add RedditSettingsPrompt component for users without Reddit settings
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 5. Create Reddit integration card component
  - Implement RedditIntegrationCard component for non-connected users
  - Add connection call-to-action
  - Integrate with existing Reddit OAuth flow
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. Create quick actions section component
  - Implement ArticleQuickActions with create article and view workflow buttons
  - Implement RedditQuickActions with view tasks and generate tasks buttons
  - Create QuickActionsSection wrapper with conditional Reddit actions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7. Implement dashboard data fetching hook
  - Create useDashboardStats hook for managing unified dashboard data
  - Implement single API call to `/api/dashboard/stats` endpoint
  - Add loading states and error recovery mechanisms
  - Handle Reddit connection status from API response
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Create main dashboard overview page component
  - Implement DashboardOverview component in `src/app/dashboard/page.tsx`
  - Integrate all metric sections with responsive grid layout
  - Add unified loading state and error boundary for dashboard
  - Handle Reddit connection status from unified API response
  - Implement conditional rendering based on data presence (check counts and array lengths)
  - Show appropriate empty states and onboarding prompts for new users
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Implement responsive design and styling
  - Add mobile-first responsive grid layout using Tailwind CSS
  - Implement card-based design consistent with existing UI components
  - Add proper spacing, typography, and visual hierarchy
  - Ensure touch-friendly interactions for mobile devices
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Add comprehensive error handling and empty states
  - Implement unified error boundary for dashboard API failures
  - Create ArticleEmptyState component with "Create your first article" call-to-action
  - Create RedditEmptyState component with "Generate your first tasks" call-to-action
  - Create RedditSettingsPrompt component for users without Reddit configuration
  - Add retry mechanism for failed dashboard stats API call
  - Handle Reddit disconnection gracefully within unified response
  - Implement graceful partial data display when some sections have no data
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11. Update navigation and routing for dashboard overview
  - Add "Overview" link to dashboard sidebar navigation
  - Remove automatic redirect from `/dashboard` to `/dashboard/articles`
  - Update navigation to highlight "Overview" when on `/dashboard` route
  - Ensure dashboard respects current project context
  - Test integration with existing workflow and Reddit pages
  - Verify quick action navigation works correctly
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
