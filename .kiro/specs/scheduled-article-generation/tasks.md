# Implementation Plan

- [ ] 1. Extend database schema for article scheduling
  - Add scheduling columns to articles table: scheduled_at, scheduling_type, scheduling_frequency, scheduling_frequency_config, next_schedule_at, last_scheduled_at, schedule_count, is_recurring_schedule, parent_article_id
  - Create generation_queue table with: id, article_id, user_id, added_to_queue_at, scheduled_for_date, queue_position, scheduling_type, status, attempts, max_attempts, error_message, timestamps
  - Add database indexes: idx_generation_queue_position, idx_generation_queue_status, idx_generation_queue_user_id, idx_generation_queue_scheduled_date
  - Write and run database migration scripts using Drizzle Kit
  - Update Drizzle schema definitions in src/server/db/schema.ts with new tables and columns
  - _Requirements: 2.2, 2.3, 4.1_

- [ ] 2. Create core scheduling API endpoints
- [ ] 2.1 Implement article scheduling API
  - Create POST /api/articles/schedule route with request/response types
  - Implement scheduling logic with frequency validation (when to add to queue)
  - Add support for both manual and automatic scheduling types
  - Add database operations for updating article scheduling fields
  - Include timezone handling and next schedule time calculation
  - _Requirements: 2.1, 2.2, 2.3, 7.1_

- [ ] 2.2 Implement generation queue API
  - Create GET /api/articles/generation-queue route with GenerationQueueResponse type
  - Create POST /api/articles/add-to-queue route with AddToQueueRequest type for manual queue additions
  - Implement queue position management (auto-assign next position when adding to queue)
  - Implement queue retrieval logic ordered by queue_position (FIFO)
  - Add DELETE /api/articles/generation-queue/[id] route for removing items from queue
  - Add filtering and pagination for large queues
  - Include queue status, position, scheduling type, and scheduled_for_date in response
  - _Requirements: 3.3, 5.1, 5.5, 7.1, 7.3_

- [ ] 2.3 Implement schedule management API
  - Create PUT /api/articles/schedule/[id] route for schedule updates
  - Create DELETE /api/articles/schedule/[id] route for schedule cancellation
  - Implement validation for schedule modifications
  - Add logic to handle recurring schedule updates
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 3. Enhance tab-based workflow with scheduling UI
- [ ] 3.1 Add scheduling controls to ArticleCard component
  - Extend ArticleCard with date/time picker for scheduling
  - Add frequency selection dropdown (once, daily, weekly, monthly)
  - Add manual "Add to Queue" button for immediate queue addition
  - Implement schedule validation and user feedback
  - Add schedule display for already scheduled articles
  - Add action buttons that trigger status changes with notifications
  - _Requirements: 2.1, 2.2, 2.4, 7.1, 7.3_

- [ ] 3.2 Create generation queue tab in workflow
  - Add "Generation Queue" tab to Content Workflow section
  - Implement queue-specific article card display with queue position and scheduled_for_date
  - Add tab badge showing queue count and processing status
  - Include queue position indicators (1st, 2nd, 3rd in queue)
  - Add manual queue management controls (remove from queue, reorder)
  - Show scheduling type (manual/automatic) on each queue item
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.3 Implement notification system for status changes
  - Create toast notification component for status change confirmations
  - Add success notifications when articles move between tabs
  - Implement error notifications for failed operations
  - Add progress notifications for ongoing scheduling operations
  - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [ ] 3.4 Implement schedule management interface
  - Create schedule editing modal/form component
  - Add bulk schedule operations (select multiple articles)
  - Implement schedule cancellation with confirmation dialogs
  - Add schedule history and status display
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 4. Create automated generation processor
- [ ] 4.1 Implement enhanced cron job for scheduled generation
  - Create or enhance /api/cron/generate-articles route
  - Phase 1: Check for articles with next_schedule_at <= NOW and scheduling_type = 'automatic'
  - Phase 1: Add these articles to generation_queue table with proper queue_position
  - Phase 2: Process generation_queue items ordered by queue_position (FIFO)
  - Phase 2: Update queue item status (queued → processing → completed/failed)
  - Phase 2: Update article status (queued → generating → wait_for_publish)
  - Process all articles in queue regardless of scheduling type (manual/automatic)
  - Call existing generation pipeline for each article
  - _Requirements: 4.1, 4.2, 4.4, 7.4_

- [ ] 4.2 Implement recurring scheduling logic
  - Add logic to calculate next_schedule_at for recurring articles after they're added to queue
  - Implement frequency calculation: daily (+1 day), weekly (+7 days), monthly (+1 month)
  - Handle scheduling_frequency_config for specific days/times (daysOfWeek, timeOfDay, monthlyDay)
  - Handle timezone conversions for accurate scheduling using user's timezone
  - For recurring schedules: keep article status as 'scheduled' and update next_schedule_at
  - For one-time schedules: update article status based on generation result
  - _Requirements: 2.5, 4.1_

- [ ] 4.3 Implement queue position management
  - Add logic to auto-assign queue_position when adding items to generation_queue
  - Implement queue position reordering when items are removed
  - Add queue position validation to prevent duplicates
  - Handle queue position updates when items are manually reordered
  - _Requirements: 3.3, 7.3_

- [ ] 4.4 Add error handling and retry mechanism
  - Implement exponential backoff for failed generations
  - Add error logging to generation_queue table
  - Create retry logic with maximum attempt limits
  - Implement queue continuity (failed items don't block queue processing)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 5. Integrate with existing generation pipeline
- [ ] 5.1 Update article status flow for scheduling
  - Update articleStatusEnum in schema.ts to include 'scheduled' and 'queued' states
  - Modify existing status transitions: idea → scheduled → queued → generating → wait_for_publish → published
  - Update tab-based workflow status validation logic to handle new statuses
  - Ensure backward compatibility with existing workflow (idea → to_generate still works)
  - Add status transition validation for scheduled articles (prevent invalid moves)
  - Implement tab switching logic when articles change status (auto-move to correct tab)
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 5.2 Enhance generation status tracking
  - Update existing generation progress tracking for scheduled articles
  - Add scheduled generation metadata to articleGeneration table
  - Implement real-time status updates for queued articles
  - Add generation history tracking for recurring articles
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. Add monitoring and management features
- [ ] 6.1 Implement generation queue monitoring
  - Create queue status dashboard component
  - Add queue length and processing time metrics
  - Implement queue health indicators and alerts
  - Add manual queue management controls (pause/resume)
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 6.2 Add schedule analytics and reporting
  - Create scheduled generation history view
  - Add success/failure rate tracking and display
  - Implement generation frequency analytics
  - Add distinction between manual and automatic scheduling in analytics
  - Add user-specific scheduling statistics
  - _Requirements: 5.4, 5.5, 7.5_

- [ ] 7. Implement comprehensive error handling
- [ ] 7.1 Add client-side error handling for scheduling
  - Implement error display for scheduling validation failures
  - Add user-friendly error messages for scheduling conflicts
  - Create error recovery options (retry, reschedule)
  - Add loading states and progress indicators for scheduling operations
  - _Requirements: 7.4, 6.4_

- [ ] 7.2 Add server-side error recovery
  - Implement database transaction rollback for failed scheduling operations
  - Add cleanup logic for orphaned generation records
  - Create system recovery procedures for restart scenarios
  - Add data consistency checks and repair mechanisms
  - _Requirements: 7.1, 7.2, 7.5_

- [ ] 8. Create comprehensive test suite
- [ ] 8.1 Write unit tests for scheduling logic
  - Test frequency calculation and next schedule time computation
  - Test schedule validation and error handling
  - Test queue processing order (FIFO) and selection logic
  - Test recurring schedule time calculation
  - _Requirements: 2.2, 2.5, 4.1_

- [ ] 8.2 Write integration tests for scheduling workflow
  - Test complete scheduling flow from UI to database
  - Test cron job processing with scheduled articles
  - Test error scenarios and recovery mechanisms
  - Test concurrent scheduling operations
  - _Requirements: 4.1, 4.2, 7.1, 7.2_

- [ ] 8.3 Write API endpoint tests
  - Test all new scheduling API routes with various inputs
  - Test authentication and authorization for scheduling operations
  - Test rate limiting and input validation
  - Test error responses and status codes
  - _Requirements: 2.1, 2.2, 6.1, 6.2_

- [ ] 9. Performance optimization and security
- [ ] 9.1 Optimize database queries for scheduling
  - Add database indexes for efficient queue queries
  - Optimize scheduled generation lookup performance
  - Add query performance monitoring and logging
  - Implement database connection pooling for cron jobs
  - _Requirements: 4.1, 5.5_

- [ ] 9.2 Implement security measures for scheduling
  - Add user authorization checks for all scheduling operations
  - Implement rate limiting for scheduling API endpoints
  - Add input sanitization and validation for scheduling parameters
  - Create audit logging for scheduling operations
  - _Requirements: 2.1, 6.1, 6.2_

- [ ] 10. Final integration and testing
- [ ] 10.1 Integration testing with existing features
  - Test scheduling integration with existing tab-based workflow
  - Test compatibility with existing article generation pipeline
  - Test user experience across all scheduling features
  - Test notification system integration with status changes
  - Verify no regression in existing functionality
  - _Requirements: 1.1, 3.1, 4.1, 5.1_

- [ ] 10.2 End-to-end testing and validation
  - Test complete user workflow from article creation to scheduled generation
  - Test recurring generation over multiple cycles
  - Test system behavior under load with many scheduled articles
  - Validate all requirements are met and working correctly
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
