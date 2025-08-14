# Implementation Plan

- [ ] 1. Set up environment configuration
  - Add Reddit client credentials to environment validation in `src/env.js`
  - _Requirements: 7.1, 7.2_

- [ ] 2. Implement Reddit OAuth authentication flow
- [ ] 2.1 Create Reddit OAuth initiation endpoint
  - Implement `src/app/api/reddit/auth/route.ts` with GET handler
  - Generate secure state parameter and build Reddit authorization URL
  - Include proper scopes: identity, mysubreddits, read, submit
  - _Requirements: 1.2, 1.3, 7.5_

- [ ] 2.2 Create Reddit OAuth callback handler
  - Implement `src/app/api/reddit/callback/route.ts` with GET handler
  - Exchange authorization code for access and refresh tokens
  - Store refresh token securely in Clerk private metadata
  - Handle OAuth errors and redirect appropriately
  - _Requirements: 1.4, 1.5, 7.3_

- [ ] 3. Implement Reddit API endpoints
- [ ] 3.1 Create subreddit search endpoint
  - Implement `src/app/api/reddit/subreddits/route.ts` with GET handler
  - Define and export TypeScript interfaces for subreddit search responses
  - Inline token refresh logic: get refresh token from Clerk, exchange for access token
  - Inline Reddit API call with proper User-Agent header and authentication
  - Call Reddit's search_reddit_names API with query parameter
  - Return formatted list of subreddit names
  - Handle search failures, token refresh failures, and empty results
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 7.2, 7.3, 8.1_

- [ ] 3.2 Create user profile and subscriptions endpoint
  - Implement `src/app/api/reddit/user/route.ts` with GET handler
  - Define and export TypeScript interfaces for Reddit profile and subreddit data
  - Inline token refresh logic: get refresh token from Clerk, exchange for access token
  - Support both profile and subreddits actions via query parameter
  - Inline Reddit API calls for identity and subscribed subreddits with proper headers
  - Handle API failures, token refresh failures, and return appropriate error messages
  - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.4, 7.2, 7.3, 8.1_

- [ ] 3.3 Create subreddit posts endpoint
  - Implement `src/app/api/reddit/subreddit/posts/route.ts` with GET handler
  - Define and export TypeScript interfaces for Reddit post data
  - Inline token refresh logic: get refresh token from Clerk, exchange for access token
  - Inline Reddit API call to fetch recent posts from specified subreddit
  - Return formatted post data with title, author, stats, and preview text
  - Handle invalid subreddit names, token refresh failures, and API failures
  - _Requirements: 5.1, 5.4, 5.5, 7.2, 7.3, 8.1_

- [ ] 3.4 Create post submission endpoint
  - Implement `src/app/api/reddit/posts/route.ts` with POST handler
  - Define and export TypeScript interfaces for post submission request/response
  - Inline token refresh logic: get refresh token from Clerk, exchange for access token
  - Validate required fields: subreddit, title, text
  - Inline Reddit API call to submit text post using submit API with proper headers
  - Handle Reddit API errors, token refresh failures, and return specific error messages
  - _Requirements: 6.1, 6.2, 6.4, 7.2, 7.3, 8.1_

- [ ] 4. Create Reddit settings page
- [ ] 4.1 Implement Reddit connection interface
  - Create `src/app/dashboard/settings/reddit/page.tsx` component
  - Add "Connect to Reddit" button that redirects to OAuth flow
  - Display connection status and handle loading states
  - Show success/error messages after OAuth completion
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ] 5. Create main Reddit dashboard page
- [ ] 5.1 Implement Reddit dashboard layout and state management
  - Create `src/app/dashboard/reddit/page.tsx` with grid layout
  - Import TypeScript interfaces from API route files
  - Set up state management for all form data and API responses
  - Implement loading states for all async operations
  - Add error handling with toast notifications
  - _Requirements: 8.1, 8.2, 8.4_

- [ ] 5.2 Implement post creation form
  - Create post submission form with subreddit, title, and text fields
  - Add form validation for required fields
  - Implement submit handler with loading state and success feedback
  - Clear form after successful submission
  - _Requirements: 6.1, 6.3, 6.5, 6.6_

- [ ] 5.3 Implement subreddit search functionality
  - Create search input with search button and loading indicator
  - Implement search results display with clickable subreddit names
  - Add click handler to populate post form subreddit field
  - Handle empty results and search failures
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 5.5 Implement subscribed subreddits list
  - Create scrollable list of user's subscribed subreddits
  - Make subreddit names clickable to populate post form
  - Handle loading states and empty subscription lists
  - Add links to open subreddits in new tabs
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.6 Implement posts browser
  - Create posts display with subreddit input and fetch button
  - Show post titles as clickable links to Reddit
  - Display post metadata: author, upvotes, comments, preview text
  - Handle loading states and fetch failures
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Add navigation and routing
- [ ] 6.1 Update dashboard navigation
  - Add Reddit link to main dashboard navigation
  - Ensure proper routing to `/dashboard/reddit` page
  - Add Reddit icon to navigation menu
  - _Requirements: General navigation requirement_

- [ ] 6.2 Update settings navigation
  - Add Reddit settings link to settings page navigation
  - Ensure proper routing to `/dashboard/settings/reddit` page
  - Group with other integration settings
  - _Requirements: General navigation requirement_

- [ ] 7. Implement comprehensive error handling
- [ ] 7.1 Add client-side error boundaries
  - Wrap Reddit components in error boundaries
  - Display user-friendly error messages for component failures
  - Provide retry mechanisms where appropriate
  - Log errors for debugging while protecting user privacy
  - _Requirements: 8.1, 8.5_

- [ ] 8.2 Implement API error response handling
  - Handle specific Reddit API error codes (400, 401, 403, 429, 500)
  - Return appropriate HTTP status codes and error messages
  - Implement retry logic for transient failures
  - Log detailed errors server-side for debugging
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
- [ ] 7.2 Implement API error response handling
- [ ] 8. Add comprehensive testing
- [ ] 8.1 Write unit tests for API route logic
  - Test token refresh logic with various scenarios in each API route
  - Test form validation and error handling in components
  - Test component state management and user interactions
  - _Requirements: All requirements - testing coverage_

- [ ] 8.2 Write integration tests for API routes
  - Test complete OAuth flow with mocked Reddit responses
  - Test all Reddit API endpoints with authentication
  - Test error handling for various failure scenarios
  - Test Clerk metadata storage and retrieval
  - _Requirements: All requirements - integration testing_
