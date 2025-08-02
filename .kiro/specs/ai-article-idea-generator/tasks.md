# Implementation Plan

- [x] 1. Create article ideas generation API endpoint
  - Implement POST /api/articles/generate-ideas route handler
  - Add request validation and authentication middleware
  - Integrate with Clerk authentication to get user context
  - Add rate limiting logic (5 requests per hour per user)
  - _Requirements: 1.1, 1.6, 5.1, 5.2, 5.5_

- [x] 2. Implement Google Gemini integration for idea generation
  - Create structured prompt template for article idea generation
  - Implement Gemini API client with proper error handling and timeouts
  - Add response parsing and validation logic
  - Create fallback mechanisms for API failures
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. personalized suggestions
  - fetch user profile data (domain, product_description, keywords)
  - Implement logic to gather existing article titles to avoid duplicates
  - Add data sanitization and validation for user profile inputs
  - Create context aggregation logic for AI prompt injection
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Create article ideas generator UI component
  - Build ArticleIdeasGenerator modal component with loading states
  - Implement "Generate Ideas" button integration in Planning Hub
  - Add loading spinner and progress indicators during generation
  - Create results display with article idea cards
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement article idea result display and actions
  - Create ArticleIdeaCard component for displaying individual suggestions
  - Add "Add to Pipeline" functionality for each idea
  - Implement bulk article creation from selected ideas
  - Add dismiss and regenerate options for the results
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
