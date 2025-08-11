# Implementation Plan

- [x] 1. Create database schema and migration for credits table
  - Add userCredits table definition to schema.ts with proper relationships
  - _Requirements: 4.1, 4.2_

- [x] 2. Implement credit allocation in Clerk webhook
  - Modify user.created case in /api/webhooks/clerk/route.ts to create credits record
  - Add database transaction to ensure atomic user and credits creation
  - User can have only one credits record, so when we add credits we update the amount in the credits table
  - Handle potential duplicate credit creation gracefully
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Create credit
  - use db api to query current credit balance
  - Implement hasCredits function for pre-generation validation
  - _Requirements: 2.2, 4.4_

- [x] 4. Add credit validation to article generation API
  - Modify /api/articles/generate/route.ts to check credits before starting generation
  - Return 402 Payment Required error when user has insufficient credits
  - Include clear error message about credit requirement
  - _Requirements: 2.3, 2.4_

- [x] 5. Implement credit deduction on successful generation
  - Add credit deduction call in article generation completion flow
  - Integrate with existing "completed" status update in generate/route.ts
  - Ensure credit deduction happens only on successful completion
  - _Requirements: 2.1, 2.2_

- [x] 6. Add credit balance display to dashboard
  - Create credit balance component showing current credits
  - Integrate credit display into dashboard left sidebar
  - Handle loading and error states for credit queries
  - Update display when credits change after generation
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Add credit validation to generation queue system
  - Modify /api/articles/schedule-generation/route.ts to check credits
  - Prevent scheduling articles when user has no credits
  - Update queue processing to validate credits before generation
  - _Requirements: 2.3, 2.4_
