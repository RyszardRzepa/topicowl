# Implementation Plan

- [x] 1. Database schema extension and domain utilities
  - Extend articleSettings schema to include excluded_domains field
  - Create domain validation and normalization utility functions
  - _Requirements: 1.2, 4.1, 4.4_

- [x] 2. Enhanced onboarding API integration
  - Update onboarding complete API to create default articleSettings with excluded domains
  - Add validation for excluded domains in onboarding flow
  - Ensure excluded domains are saved to articleSettings during onboarding
  - _Requirements: 1.2, 1.3_

- [x] 3. Article settings API enhancement for excluded domains
  - Update main /api/settings API to handle excluded_domains field in GET and POST operations
  - Add validation for excluded domains in settings update flow using domain utilities
  - Update ArticleSettingsRequest/Response types to include excluded_domains
  - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3_

- [x] 4. Article generation API integration with domain filtering
  - Update outline API to retrieve user's excluded domains from articleSettings and filter sources
  - Update writing API to filter excluded domains from provided sources
  - Update research API to filter excluded domains from search results
  - Add utility functions to retrieve excluded domains for article generation context
  - Add logging for domain filtering actions
  - _Requirements: 3.1, 3.2, 5.2, 5.3, 5.4_

- [x] 5. Enhanced AI prompts with exclusion instructions
  - Update outline prompt to include excluded domains in instructions
  - Update writing prompt to include excluded domains in instructions
  - Update research prompt to include excluded domains in instructions
  - Ensure prompts instruct AI to avoid linking to excluded domains
  - _Requirements: 3.3_

- [x] 6. Excluded domains form component
  - Create ExcludedDomainsField component for article settings form
  - Implement domain input form with validation and normalization using domain utilities
  - Add ability to add/remove domains with visual feedback
  - Integrate component into existing article settings form
  - _Requirements: 1.1, 2.1, 4.1, 4.2, 6.2_

- [x] 7. Frontend integration and user experience
  - Update article settings form to include excluded domains field
  - Implement loading states and error handling in UI components
  - Add confirmation messages for successful domain operations
  - Ensure excluded domains are properly saved and retrieved with other settings
  - _Requirements: 1.1, 1.4, 2.1, 6.1, 6.2, 6.3_

- [x] 8. Database schema cleanup and migration
  - Remove unused blacklisted_domains column from users table (added in migration 0026)
  - Ensure excluded_domains field in articleSettings table is properly migrated
  - Run database push to sync schema changes
  - _Requirements: 5.1_