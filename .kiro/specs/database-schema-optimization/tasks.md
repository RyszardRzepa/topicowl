# Implementation Plan

- [ ] 1. Create enhanced articles table schema
  - Create new Drizzle schema definition with consolidated fields
  - Add new enums for generation phases and updated status values
  - Include proper indexes for optimized queries
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Create database migration script
  - Write Drizzle migration to add new fields to articles table
  - Preserve existing data during schema changes
  - Add proper constraints and defaults for new fields
  - _Requirements: 1.1, 2.1, 3.1, 6.1_

- [ ] 3. Implement data migration utilities
  - Create utility functions to migrate data from articleGeneration table
  - Create utility functions to migrate data from generationQueue table
  - Implement data validation and consistency checks
  - _Requirements: 1.1, 2.2, 5.1, 5.2_

- [ ] 4. Update article generation API to use consolidated schema
  - Modify `/api/articles/generate/route.ts` to update articles table directly
  - Remove dependencies on articleGeneration table
  - Update generation progress tracking to use new fields
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Update generation status API for simplified queries
  - Modify `/api/articles/[id]/generation-status/route.ts` to query articles table only
  - Remove complex joins with articleGeneration table
  - Update response format to match new schema structure
  - _Requirements: 2.1, 2.2, 4.1, 4.3_

- [ ] 6. Update kanban board API for optimized queries
  - Modify `/api/articles/board/route.ts` to use single table query
  - Remove LEFT JOIN with articleGeneration table
  - Update article transformation logic for new field names
  - _Requirements: 1.3, 4.1, 4.2, 6.2_

- [ ] 7. Update cron job to use articles table for queue management
  - Modify `/api/cron/generate-articles/route.ts` to query articles directly
  - Remove generationQueue table dependencies
  - Update queue processing logic to use article status and scheduling fields
  - _Requirements: 5.1, 5.2, 5.3, 3.2_

- [ ] 8. Update generation queue API for simplified queue management
  - Modify `/api/articles/generation-queue/route.ts` to query articles table
  - Remove generationQueue table queries
  - Update queue position logic using article ordering
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 9. Update WorkflowDashboard component for new schema
  - Modify article transformation logic in workflow-dashboard.tsx
  - Update field mappings to use new consolidated field names
  - Remove complex status correction logic that's no longer needed
  - _Requirements: 4.1, 4.2, 6.2, 6.3_

- [ ] 10. Update article scheduling APIs
  - Modify schedule-generation and schedule-publishing endpoints
  - Use consolidated scheduling fields in articles table
  - Remove generationQueue table operations
  - _Requirements: 3.1, 3.2, 3.3, 5.1_

- [ ] 11. Create database cleanup migration
  - Write migration to drop articleGeneration table
  - Write migration to drop generationQueue table
  - Remove unused fields from articles table
  - _Requirements: 1.1, 5.1_

- [ ] 12. Update TypeScript types and interfaces
  - Update Article interface to match new schema
  - Remove ArticleGeneration and GenerationQueue types
  - Update API response types for simplified structure
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 13. Add comprehensive error handling for consolidated schema
  - Update error handling in generation process
  - Implement retry logic using articles table fields
  - Add proper status transition validation
  - _Requirements: 2.4, 4.4, 5.4_

- [ ] 14. Create integration tests for schema optimization
  - Write tests for data migration utilities
  - Test WorkflowDashboard with optimized queries
  - Test article generation process with new schema
  - _Requirements: 1.3, 2.1, 4.1, 4.2_

- [ ] 15. Performance testing and optimization
  - Test query performance with simplified schema
  - Validate index effectiveness for common queries
  - Benchmark WorkflowDashboard loading times
  - _Requirements: 1.3, 4.2_