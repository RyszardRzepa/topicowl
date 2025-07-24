# Implementation Plan

- [ ] 1. Update database schema and types for enhanced article model
  - Add new fields to articles table: generationProgress, estimatedReadTime, views, clicks
  - Update Article type in src/types/types.ts to match enhanced model
  - Create database migration for new fields
  - _Requirements: 2.3, 3.3, 5.2, 5.3_

- [ ] 2. Create core workflow components and layout structure
  - [ ] 2.1 Create WorkflowTabs component for navigation between planning and publishing
    - Implement tab-based navigation with active state management
    - Add keyboard navigation support (arrow keys, tab)
    - Create responsive design that works on mobile devices
    - _Requirements: 4.1, 4.5_

  - [ ] 2.2 Create ArticleCard component with mode-specific rendering
    - Implement planning mode display (status, generation actions, scheduling)
    - Implement publishing mode display (publish actions, metadata, analytics)
    - Add proper accessibility attributes and ARIA labels
    - _Requirements: 1.4, 5.1, 5.4_

  - [ ] 2.3 Create StatusIndicator component for clear visual feedback
    - Implement status badges with appropriate colors and icons
    - Add progress bars for generation status with real-time updates
    - Create time display utilities for relative time formatting
    - _Requirements: 5.1, 5.2, 5.5_

- [ ] 3. Implement Article Planning Hub interface
  - [ ] 3.1 Create PlanningHub component with article creation and management
    - Build simplified article creation form (title and optional keywords only)
    - Implement article ideas list with clear status grouping
    - Add prominent "Add Article Idea" button and form
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 3.2 Implement generation actions and scheduling
    - Create "Generate Now" button functionality for individual articles
    - Build generation scheduling modal with date/time picker
    - Add scheduled generation display and edit capabilities
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Add bulk operations for planning workflow
    - Implement "Generate All" functionality for multiple articles
    - Create "Schedule All" bulk scheduling with time distribution
    - Add multi-select interface for batch operations
    - _Requirements: 6.1, 6.2_

- [ ] 4. Implement Publishing Pipeline interface
  - [ ] 4.1 Create PublishingPipeline component for completed articles
    - Build ready-to-publish articles list with metadata display
    - Implement published articles archive with basic analytics
    - Add clear section separation and article counts
    - _Requirements: 4.2, 4.3_

  - [ ] 4.2 Implement publishing actions and scheduling
    - Create "Publish Now" button functionality for individual articles
    - Build publishing scheduling modal with date/time picker
    - Add scheduled publishing display and edit capabilities
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 4.3 Add bulk publishing operations
    - Implement "Publish All Ready" functionality
    - Create bulk publishing scheduling interface
    - Add confirmation dialogs for bulk publishing actions
    - _Requirements: 6.1, 6.3_

- [ ] 5. Update API endpoints for new workflow functionality
  - [ ] 5.1 Enhance articles API to support workflow state management
    - Update GET /api/articles/board to return articles grouped by workflow phase
    - Modify article update endpoints to handle new status transitions
    - Add validation for workflow state changes
    - _Requirements: 4.4, 5.5_

  - [ ] 5.2 Create scheduling API endpoints
    - Implement POST /api/articles/[id]/schedule-generation endpoint
    - Implement POST /api/articles/[id]/schedule-publishing endpoint
    - Add bulk scheduling endpoints for multiple articles
    - _Requirements: 2.2, 2.5, 3.2, 3.5_

  - [ ] 5.3 Update generation and publishing APIs for enhanced tracking
    - Modify generation API to update progress and completion tracking
    - Update publishing API to handle scheduled publishing
    - Add analytics tracking for published articles
    - _Requirements: 5.2, 5.3_

- [ ] 6. Implement real-time updates and progress tracking
  - [ ] 6.1 Create generation progress tracking system
    - Implement WebSocket or polling for real-time generation progress
    - Add progress bar updates and estimated completion time
    - Create error handling for failed generations
    - _Requirements: 5.2_

  - [ ] 6.2 Add automatic status transitions and notifications
    - Implement automatic movement from generating to ready status
    - Add automatic publishing for scheduled articles
    - Create user notifications for completed actions
    - _Requirements: 2.5, 3.5, 4.4_

- [ ] 7. Create enhanced user interaction features
  - [ ] 7.1 Implement quick action modals and forms
    - Create reusable scheduling modal component with presets
    - Build confirmation dialogs for destructive actions
    - Add keyboard shortcuts for common actions
    - _Requirements: 6.4, 6.5_

  - [ ] 7.2 Add filtering and search capabilities
    - Implement status-based filtering for both workflows
    - Add search functionality for article titles
    - Create date range filtering for scheduled articles
    - _Requirements: 1.4, 4.2_

- [ ] 8. Replace existing kanban board with new workflow interface
  - [ ] 8.1 Create new main dashboard component
    - Build WorkflowDashboard component that combines planning and publishing
    - Implement proper state management for workflow navigation
    - Add responsive design for mobile and tablet devices
    - _Requirements: 4.1, 4.5_

  - [ ] 8.2 Update main page to use new workflow interface
    - Replace KanbanBoard component with WorkflowDashboard in src/app/page.tsx
    - Update navigation and layout to accommodate new interface
    - Ensure proper authentication and loading states
    - _Requirements: 4.1_

- [ ] 9. Add comprehensive error handling and user feedback
  - [ ] 9.1 Implement user-friendly error messages and recovery
    - Create error boundary components for graceful failure handling
    - Add specific error messages for common failure scenarios
    - Implement retry mechanisms for failed operations
    - _Requirements: 5.5, 6.5_

  - [ ] 9.2 Add loading states and optimistic updates
    - Implement loading indicators for all async operations
    - Add optimistic updates for immediate user feedback
    - Create skeleton loading states for better perceived performance
    - _Requirements: 6.5_

- [ ] 10. Write comprehensive tests for new workflow functionality
  - [ ] 10.1 Create unit tests for workflow components
    - Test WorkflowTabs navigation and state management
    - Test ArticleCard rendering in different modes
    - Test StatusIndicator component with various states
    - _Requirements: All requirements_

  - [ ] 10.2 Create integration tests for workflow APIs
    - Test article creation and status transitions
    - Test scheduling functionality for generation and publishing
    - Test bulk operations and error handling
    - _Requirements: All requirements_