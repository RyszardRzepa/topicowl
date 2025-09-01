# Implementation Plan

- [ ] 1. Create core calendar infrastructure and API endpoints
  - Set up the foundational API endpoints for calendar-based article management
  - Create database query functions for week-based article retrieval
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 1.1 Create weekly articles API endpoint
  - Implement GET /api/articles/calendar/week endpoint
  - Add query logic to fetch articles by week with proper project filtering
  - Include proper authentication and project ownership validation
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 1.2 Create article generation scheduling API endpoint
  - Implement POST /api/articles/schedule-generation endpoint
  - Add validation for future dates and article status requirements
  - Update article generationScheduledAt field in database
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 1.3 Create article rescheduling API endpoint
  - Implement PUT /api/articles/[id]/reschedule endpoint
  - Support both generation and publishing schedule updates
  - Add proper validation and error handling for schedule conflicts
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 1.4 Enhance existing article creation API
  - Modify POST /api/articles to accept scheduling parameters
  - Add support for creating articles with pre-set scheduled times
  - Ensure backward compatibility with existing article creation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. Build calendar layout and time slot components
  - Create the visual calendar grid structure with time slots
  - Implement time slot click handlers for article creation
  - Add proper responsive design and accessibility features
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.1 Create ArticleCalendarGrid component
  - Build weekly calendar layout with 7-day columns and 24-hour rows
  - Implement time slot rendering with proper spacing and labels
  - Add week navigation controls (previous, next, today buttons)
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 2.2 Create TimeSlot component with click handlers
  - Implement individual time slot components with click detection
  - Add hover effects and visual feedback for interactive slots
  - Create click handler to trigger article creation form
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.3 Add calendar header and navigation
  - Create calendar header showing current week range
  - Implement navigation buttons for week traversal
  - Add "Today" button to jump to current week
  - _Requirements: 1.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3. Implement article positioning and overlap handling
  - Create algorithm to position articles in time slots based on scheduled dates
  - Handle multiple articles in same time slot with proper visual layout
  - Ensure all overlapped articles remain clickable and accessible
  - _Requirements: 1.2, 1.3, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 3.1 Create article positioning algorithm
  - Implement function to calculate article position based on scheduled time
  - Convert article scheduled dates to calendar grid coordinates
  - Handle different article types (generation vs publishing schedules)
  - _Requirements: 1.2, 1.3_

- [ ] 3.2 Implement overlap detection and layout
  - Create algorithm to detect overlapping articles in same time slots
  - Implement column-based layout for overlapped articles
  - Add visual stacking with proper z-index management
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 3.3 Create ArticleCard component for calendar display
  - Build article card component with status-based styling
  - Add proper visual indicators for different article phases
  - Implement hover effects and interaction states
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4. Build drag and drop functionality
  - Implement drag and drop for rescheduling articles between time slots
  - Add visual feedback during drag operations
  - Create drop validation and API integration for schedule updates
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.1 Add drag handlers to ArticleCard component
  - Implement onDragStart, onDragEnd event handlers
  - Add visual feedback for dragged articles (opacity, scaling)
  - Prevent dragging of articles in invalid states
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4.2 Implement drop zones in TimeSlot components
  - Add onDragOver, onDragLeave, onDrop event handlers to time slots
  - Create visual feedback for valid drop targets
  - Add validation to prevent dropping on invalid time slots
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4.3 Create drag and drop state management
  - Implement global drag state to track dragged article and target slot
  - Add optimistic updates for immediate UI feedback
  - Create error handling and revert logic for failed operations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.4 Integrate drag and drop with rescheduling API
  - Connect drop operations to article rescheduling API endpoint
  - Add proper error handling and user feedback for API failures
  - Implement retry logic for network failures
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 5. Create article creation form and modal
  - Build form for creating new articles from time slot clicks
  - Implement article detail modal for viewing and managing existing articles
  - Add proper form validation and error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 5.1 Create ArticleCreationForm component
  - Build form with fields for title, keywords, notes, target audience
  - Pre-populate scheduled date and time from clicked time slot
  - Add form validation and submission handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 5.2 Create ArticleDetailModal component
  - Build modal to display article details and metadata
  - Show article content, status, and scheduling information
  - Add proper modal accessibility and keyboard navigation
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 5.3 Add article action buttons to modal
  - Implement status-appropriate action buttons (Generate, Schedule, Publish)
  - Add confirmation dialogs for destructive actions
  - Create loading states and success/error feedback
  - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 5.4 Integrate forms with article APIs
  - Connect creation form to enhanced article creation API
  - Connect modal actions to generation, scheduling, and publishing APIs
  - Add proper error handling and user feedback
  - _Requirements: 2.4, 2.5, 5.4, 5.5, 5.6_

- [ ] 6. Implement article status visualization and categorization
  - Create visual system for different article workflow phases
  - Add proper icons, colors, and indicators for each status
  - Implement progress indicators for generating articles
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6.1 Create article status classification system
  - Implement function to categorize articles by workflow phase
  - Map article status and scheduling fields to calendar categories
  - Handle edge cases and invalid states gracefully
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6.2 Design status-based visual styling
  - Create color scheme and icon system for different article phases
  - Implement consistent styling across ArticleCard components
  - Add accessibility considerations for color-blind users
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6.3 Add progress indicators for generating articles
  - Show generation progress bars for articles in "generating" status
  - Display current generation phase (research, writing, validation)
  - Add real-time updates for generation progress
  - _Requirements: 4.2_

- [ ] 7. Create main calendar view component and integration
  - Build main ArticleCalendarView component that orchestrates all sub-components
  - Integrate with existing project context and authentication
  - Add proper loading states and error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 7.1 Create ArticleCalendarView container component
  - Build main component that manages calendar state and data fetching
  - Integrate with project context to filter articles by current project
  - Add proper authentication checks and user access validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 7.2 Implement calendar data fetching and state management
  - Create hooks for fetching weekly article data
  - Implement state management for calendar view (current week, selected articles)
  - Add proper loading states and error handling for API calls
  - _Requirements: 1.1, 1.2, 1.5, 9.4, 9.5_

- [ ] 7.3 Add real-time updates and polling
  - Implement polling for article generation status updates
  - Add automatic refresh when articles complete generation or publishing
  - Create efficient update mechanism to avoid unnecessary re-renders
  - _Requirements: 4.2, 6.4, 6.5, 7.4, 7.5_

- [ ] 8. Implement bulk operations and week-based article generation
  - Add functionality to generate multiple article ideas for a week
  - Create bulk scheduling operations for multiple articles
  - Implement efficient batch API calls and optimistic updates
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 8.1 Create week-based article idea generation
  - Implement "Generate Ideas for Week" functionality
  - Distribute generated ideas across available time slots in current week
  - Use project settings and keywords for relevant topic suggestions
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 8.2 Add bulk scheduling operations
  - Create functionality to schedule multiple articles at once
  - Implement batch API calls for efficient server communication
  - Add progress indicators and error handling for bulk operations
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 8.3 Create bulk action UI components
  - Add bulk selection checkboxes to article cards
  - Create bulk action toolbar with scheduling and generation options
  - Implement confirmation dialogs for bulk operations
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 9. Replace existing workflow dashboard with calendar view
  - Update dashboard routing to use calendar as primary interface
  - Ensure feature parity with existing workflow functionality
  - Add migration path and backward compatibility
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 9.1 Update dashboard routing and navigation
  - Modify /dashboard/articles route to render calendar view by default
  - Update navigation components to reflect calendar-first approach
  - Ensure proper breadcrumb and URL management
  - _Requirements: 1.1_

- [ ] 9.2 Ensure feature parity with existing workflow
  - Verify all existing article management features work in calendar view
  - Test article creation, generation, scheduling, and publishing workflows
  - Ensure no functionality is lost in the transition
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 9.3 Add comprehensive testing for calendar functionality
  - Create unit tests for calendar layout algorithms and components
  - Add integration tests for API endpoints and data flow
  - Implement end-to-end tests for complete user workflows
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 10. Performance optimization and polish
  - Optimize calendar rendering performance for large numbers of articles
  - Add proper loading states and skeleton screens
  - Implement accessibility features and keyboard navigation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 10.1 Optimize calendar rendering performance
  - Implement virtual scrolling for time slots if needed
  - Add memoization to prevent unnecessary component re-renders
  - Optimize article positioning calculations for large datasets
  - _Requirements: 1.1, 1.2, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 10.2 Add accessibility features
  - Implement proper ARIA labels and keyboard navigation
  - Add screen reader support for calendar navigation and article management
  - Ensure color contrast meets accessibility standards
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 10.3 Create loading states and error boundaries
  - Add skeleton screens for calendar loading states
  - Implement error boundaries to handle component failures gracefully
  - Create user-friendly error messages and recovery options
  - _Requirements: 1.1, 1.2, 1.5, 9.4, 9.5_