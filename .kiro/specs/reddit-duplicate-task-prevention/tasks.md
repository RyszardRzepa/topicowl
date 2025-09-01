# Implementation Plan

- [ ] 1. Create Reddit API functions for fetching posts
  - Create `src/lib/reddit/api.ts` with pure functions for Reddit API interactions
  - Implement `fetchLatestPosts` function that takes subreddits array and returns posts
  - Implement `refreshRedditToken` and `fetchUserSubreddits` helper functions
  - Add proper TypeScript interfaces for Reddit API responses and function parameters
  - Include error handling and retry logic within each function
  - _Requirements: Maintainability, Code Organization_

- [ ] 2. Create Reddit post evaluation functions
  - Create `src/lib/reddit/evaluation.ts` with AI evaluation functions
  - Implement `evaluatePostsForRelevance` function that takes posts and project context
  - Implement `generateEvaluationPrompt` helper function for consistent prompts
  - Add interfaces for evaluation results, project context, and configuration
  - Include batch processing and error handling for individual post failures
  - _Requirements: Maintainability, Code Organization_

- [ ] 3. Create Reddit duplicate prevention functions
  - Create `src/lib/reddit/duplicate-prevention.ts` with duplicate handling functions
  - Implement `getExistingProcessedPostIds` function for batch duplicate checking
  - Implement `filterDuplicatePosts` function to remove already processed posts
  - Implement `recordProcessedPosts` function for batch insertion with conflict handling
  - Add proper error handling, logging, and return detailed filtering statistics
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 3.1_

- [ ] 4. Create Reddit task generation functions
  - Create `src/lib/reddit/task-generation.ts` with task creation functions
  - Implement `generateTasksFromPosts` function that creates scheduled tasks
  - Implement `generateAiDraft` function for creating reply drafts
  - Implement `distributeTasksAcrossWeek` helper function for scheduling
  - Add interfaces for task configuration, generation results, and scheduling options
  - _Requirements: Maintainability, Code Organization_

- [ ] 5. Create Reddit utilities and validation functions
  - Create `src/lib/reddit/utils.ts` with utility and validation functions
  - Implement `normalizeRedditPostId` function for consistent "t3\_" format
  - Implement `validateRedditPost` function for input validation
  - Implement `extractPostIdFromUrl`, `formatSubredditName`, and other helpers
  - Add comprehensive input validation and error handling
  - _Requirements: 2.4, 2.2, 2.3_

- [ ] 6. Add database operations for processed posts tracking
  - Import `redditProcessedPosts` table in duplicate prevention module
  - Add necessary Drizzle ORM imports (`inArray`, `sql` for conflict handling)
  - Implement batch queries using `inArray` for checking existing posts efficiently
  - Implement batch insertion with `INSERT ... ON CONFLICT DO NOTHING` pattern
  - Add proper error handling for database constraint violations
  - _Requirements: 1.1, 1.3, 1.4_

- [ ] 7. Implement duplicate filtering in main workflow
  - Integrate duplicate prevention functions after post fetching
  - Filter out duplicate posts before running expensive AI evaluation
  - Log comprehensive statistics about duplicates found (count, titles, subreddits)
  - Return detailed filtering results for response and debugging
  - _Requirements: 1.1, 1.2, 3.2, 4.1_

- [ ] 8. Integrate post recording after successful task creation
  - Call `recordProcessedPosts` function after tasks are successfully saved
  - Pass only the posts that were actually used for task generation
  - Add error handling that logs failures but doesn't break the main workflow
  - Ensure recording happens atomically with task creation where possible
  - _Requirements: 1.3, 2.2_

- [ ] 9. Create main orchestration function for task generation
  - Create `src/lib/reddit/task-generation-orchestrator.ts` with main workflow function
  - Implement `generateRedditTasks` function that orchestrates the entire process
  - Chain together: fetch posts → filter duplicates → evaluate → generate tasks → record
  - Keep function pure by accepting all dependencies as parameters (db, userId, projectId, etc.)
  - Return comprehensive results including statistics and generated tasks
  - _Requirements: Maintainability, Code Organization_

- [ ] 10. Refactor API route to use orchestration function
  - Replace all inline logic with a single call to the orchestration function
  - Keep route handler focused on HTTP concerns: auth, validation, error responses
  - Pass all required dependencies (db connection, user context, etc.) to orchestrator
  - Transform orchestrator results into appropriate HTTP responses
  - Maintain existing authentication, validation, and project ownership checks
  - _Requirements: Maintainability, Code Organization_

- [ ] 11. Add comprehensive error handling and logging
  - Implement consistent error handling patterns across all Reddit functions
  - Add performance timing logs for each major operation (fetch, evaluate, generate)
  - Log duplicate filtering statistics and database operation results
  - Create error types for different failure scenarios (API errors, validation errors, etc.)
  - Ensure graceful degradation when individual operations fail
  - _Requirements: 2.2, 2.3, 4.1, 4.4_

- [ ] 12. Enhance API response with detailed statistics
  - Extend response object to include comprehensive duplicate filtering statistics
  - Add fields: `duplicatesFiltered`, `totalPostsEvaluated`, `duplicateDetails`, `processingTime`
  - Include detailed breakdown of each processing step and its results
  - Add debug information and detailed error messages in development mode
  - Provide actionable feedback when no tasks can be generated
  - _Requirements: 4.2, 4.3_
