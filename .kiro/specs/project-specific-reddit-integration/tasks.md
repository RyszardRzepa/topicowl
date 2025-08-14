# Implementation Plan

- [ ] 1. TypeScript types and interfaces setup
  - Define TypeScript interfaces for Clerk private metadata structure
  - Create types for project-specific Reddit connections
  - Add utility types for Reddit token management
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 2. Identify reusable Reddit token operations
  - Analyze all Reddit API routes to identify common token operations
  - Determine which operations are used in 3+ places and need utility functions
  - Keep simple operations inline in individual routes
  - _Requirements: 2.2, 2.3, 4.2_

- [ ] 3. Update Reddit authentication flow
  - Modify `/api/reddit/auth` to accept and handle project ID parameter
  - Update OAuth state generation to include project context
  - Add project ID validation and ownership checks
  - _Requirements: 2.1, 2.2_

- [ ] 4. Update Reddit OAuth callback handler
  - Modify `/api/reddit/callback` to extract project ID from OAuth state
  - Inline token storage logic using project-keyed structure in Clerk metadata
  - Inline Reddit user info fetching and storage with project association
  - Implement proper error handling for project context
  - _Requirements: 2.2, 2.3_

- [ ] 5. Update Reddit connection status endpoint
  - Modify `/api/reddit/status` to return project-specific connection status
  - Inline project context validation and ownership checks
  - Inline Clerk metadata reading for connection status
  - Update response format to include project-specific data
  - _Requirements: 1.3, 4.1_

- [ ] 6. Update Reddit disconnection endpoint
  - Modify `/api/reddit/disconnect` to remove project-specific connection
  - Inline token revocation logic with Reddit API
  - Inline Clerk metadata cleanup for project connection
  - Add proper error handling for disconnection failures
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Update Reddit API endpoints for project context
  - Modify `/api/reddit/posts` to inline project-specific token retrieval
  - Update `/api/reddit/user` to inline project-specific token retrieval
  - Inline project context validation in all Reddit endpoints
  - Inline automatic token refresh logic in API calls
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Update remaining Reddit API endpoints
  - Modify `/api/reddit/subreddits` to inline project-specific token retrieval
  - Update `/api/reddit/subreddit/posts` to inline project-specific token retrieval
  - Inline consistent error handling for missing connections
  - Inline project ownership validation in all endpoints
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Create reusable utility functions (if needed)
  - Review all implemented Reddit API routes for repeated code patterns
  - Create utility functions only for operations used in 3+ places
  - Keep functions minimal and focused on specific operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 10. Create data migration script
  - Write migration script to convert existing user Reddit connections to project-keyed format
  - Associate existing connections with user's primary project in new metadata structure
  - Update Clerk private metadata to new format and clean up old structure
  - Add rollback functionality for migration failures
  - _Requirements: 5.4_

- [ ] 11. Add comprehensive error handling
  - Implement proper error responses for missing project context
  - Add error handling for expired or invalid Reddit connections
  - Create user-friendly error messages for authentication failures
  - Add logging for Reddit API failures and token refresh issues
  - _Requirements: 3.4, 4.3, 4.4, 6.3_

- [ ] 12. Create unit tests for core functionality
  - Write tests for any reusable utility functions (if created)
  - Create tests for Clerk metadata operations and structure validation
  - Test project context validation logic in API routes
  - _Requirements: All requirements validation_

- [ ] 13. Create integration tests for API routes
  - Test complete OAuth flow with project context
  - Verify token refresh and expiration handling
  - Test all Reddit API endpoints with project-specific tokens
  - Validate error handling for various failure scenarios
  - _Requirements: All requirements validation_
