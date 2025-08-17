# Implementation Plan

- [x] 1. Database schema implementation
  - Add `redditPosts` table to `src/server/db/schema.ts` with proper indexes
  - Include all required fields: projectId, userId, subreddit, title, text, status, publishScheduledAt, publishedAt, timestamps
  - Reuse existing `articleStatusEnum` for consistency with article scheduling
  - Add proper foreign key references
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Modify existing Reddit posts API for scheduling support
- [x] 2.1 Update POST /api/reddit/posts route for scheduling
  - Modify `src/app/api/reddit/posts/route.ts` POST handler to support optional `publishScheduledAt` parameter
  - Add validation for future date scheduling (prevent past dates)
  - Implement conditional logic: if `publishScheduledAt` provided, store in database with 'scheduled' status
  - If no `publishScheduledAt`, maintain existing immediate posting behavior
  - Update TypeScript interfaces for request/response to include scheduling fields
  - Add proper error handling for scheduling validation failures
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 7.3, 9.1, 9.2_

- [x] 3. Create scheduled posts management API endpoints
- [x] 3.1 Create GET /api/reddit/posts/scheduled route
  - Implement `src/app/api/reddit/posts/scheduled/route.ts` with GET handler
  - Query `redditPosts` table filtered by projectId and user permissions
  - Return scheduled posts sorted by `publishScheduledAt` ascending
  - Include proper TypeScript interfaces for response data
  - Handle empty results and database errors gracefully
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.2 Create PUT /api/reddit/posts/[id] route for editing
  - Implement `src/app/api/reddit/posts/[id]/route.ts` with PUT handler
  - Allow updating subreddit, title, text, and publishScheduledAt for scheduled posts
  - Validate user permissions (project-based isolation)
  - Only allow editing posts with 'scheduled' status
  - Update database record and return updated post data
  - Handle validation errors and permission failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3.3 Create DELETE /api/reddit/posts/[id] route for cancellation
  - Implement DELETE handler in `src/app/api/reddit/posts/[id]/route.ts`
  - Validate user permissions and post ownership
  - Only allow deletion of posts with 'scheduled' status
  - Remove post from database and return confirmation
  - Handle cases where post doesn't exist or is already published
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Create automated publishing cron job
- [x] 4.1 Implement cron job for publishing scheduled posts
  - Create `src/app/api/cron/publish-reddit-posts/route.ts` with POST handler
  - Query `redditPosts` table for posts with status 'scheduled' and `publishScheduledAt <= NOW()`
  - For each due post: retrieve user's Reddit refresh token from Clerk metadata
  - Exchange refresh token for access token using Reddit OAuth flow
  - Submit post to Reddit API using existing Reddit integration patterns
  - Update post status to 'published' on success or 'failed' on error
  - Store `publishedAt` timestamp and error details as needed
  - Implement proper error handling and retry logic with exponential backoff
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.3, 9.4, 9.5_

- [x] 5. Enhance Reddit dashboard UI for scheduling
- [x] 5.1 Add scheduling toggle to post creation form
  - Modify `src/app/dashboard/reddit/page.tsx` to include scheduling state management
  - Add Switch component to toggle between immediate and scheduled posting modes
  - Import and integrate existing DateTimePicker component for consistency
  - Update form validation to handle scheduling mode requirements
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5.2 Implement DateTimePicker integration
  - Add DateTimePicker component to post creation form when scheduling is enabled
  - Configure DateTimePicker with `minDate` set to current date to prevent past scheduling
  - Handle date selection and validation in form state
  - Show selected date/time clearly in the UI
  - Maintain form field values when switching between immediate and scheduled modes
  - _Requirements: 1.2, 1.3, 7.1, 7.4, 9.1_

- [x] 5.3 Create scheduled posts display component
  - Add new "Scheduled Posts" card to the Reddit dashboard layout
  - Implement state management for loading and displaying scheduled posts
  - Create `ScheduledPostItem` component to display individual scheduled posts
  - Show post title, subreddit, scheduled time, and current status for each post
  - Include Edit and Delete action buttons for each scheduled post
  - Handle loading states and empty states appropriately
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2_

- [x] 5.4 Implement scheduled post management functionality
  - Add click handlers for Edit and Delete actions on scheduled posts
  - Implement edit functionality: populate creation form with existing post data
  - Add confirmation dialog for post deletion with proper UX
  - Handle API calls for updating and deleting scheduled posts
  - Update local state and UI after successful operations
  - Display appropriate success/error messages using toast notifications
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Add real-time status updates and feedback
- [x] 6.1 Implement status display for scheduled posts
  - Add status indicators to scheduled post items (scheduled, publishing, published, failed)
  - Use appropriate icons and colors for different status states
  - Display published timestamp for successfully published posts
  - Show error details for failed posts with user-friendly messages
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Fix TypeScript issues in cron job implementation
- [x] 7.1 Resolve type safety issues in cron job
  - ✅ Fixed unsafe assignments from API responses by removing unnecessary type assertions
  - ✅ Removed manual type assertions and let Drizzle ORM handle type inference properly
  - ✅ Added proper error handling for database query results
  - ✅ Ensured all database operations have proper type safety
  - ✅ All TypeScript issues in the cron job file have been resolved
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.3, 9.4, 9.5_
