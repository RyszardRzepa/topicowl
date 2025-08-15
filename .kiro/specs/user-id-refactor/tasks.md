# Implementation Plan

- [x] 2. Update database schema definition
  - Modify users table schema to use Clerk user ID as primary key
  - Remove clerk_user_id column definition from schema
  - Update all foreign key references to point to new user ID structure
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Update Clerk webhook handler for new user ID structure
  - Modify user creation logic to use Clerk user ID as primary key
  - Update user lookup queries to use id instead of clerk_user_id
  - Update user update and deletion operations for new schema
  - Fix TypeScript errors and ensure proper error handling
  - _Requirements: 1.4, 3.5_

- [x] 4. Update user lookup patterns in articles API routes
  - Modify all user lookup queries in articles/\* API routes to use Clerk user ID directly
  - Update user validation logic to query by id instead of clerk_user_id
  - Ensure all article-related operations work with new user ID structure
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Update user lookup patterns in settings API routes
  - Modify all user lookup queries in settings/\* API routes to use Clerk user ID directly
  - Update settings creation and update operations for new user ID structure
  - Ensure webhook settings and other user settings work correctly
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Update user lookup patterns in onboarding API routes
  - Modify all user lookup queries in onboarding/\* API routes to use Clerk user ID directly
  - Update onboarding completion and website analysis operations
  - Ensure user creation during onboarding works with new schema
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Update user lookup patterns in credits and other API routes
  - Modify user lookup queries in credits API route to use Clerk user ID directly
  - Update sitemaps API route user validation
  - Ensure all remaining API routes work with new user ID structure
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
