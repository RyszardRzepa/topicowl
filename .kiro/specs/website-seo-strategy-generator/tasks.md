# Implementation Plan

- [x] 1. Set up core API route for SEO strategy analysis
  - Create `/api/tools/seo-cluster-map/analyze/route.ts` with POST endpoint
  - Implement URL validation and sanitization logic
  - Integrate Vercel AI SDK with Google Gemini 2.5 Flash model
  - Configure `google.tools.urlContext({})` for website content extraction
  - Add structured system prompt for SEO strategy generation
  - Implement error handling for invalid URLs and API failures
  - Add retry logic (up to 3 attempts) for failed AI requests
  - Remove authentication requirements (public endpoint)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.4_

- [x] 2. Create URL input form component
  - Build `UrlInputForm` component with URL validation
  - Implement client-side URL format validation using URL constructor
  - Add form submission handling with loading states
  - Create responsive form layout using existing UI components
  - Add proper error messaging for invalid URLs
  - _Requirements: 4.1, 4.2, 4.5, 4.6_

- [x] 3. Implement analysis progress tracking component
  - Create `AnalysisProgress` component with loading indicators
  - Add progress states (validating URL, analyzing content, generating strategy)
  - Implement timeout handling after 60 seconds
  - Use existing UI components for consistent styling
  - _Requirements: 4.2, 4.5_

- [x] 4. Build strategy report display component
  - Create `StrategyReport` component to render AI-generated strategy
  - Parse and format the strategy text into structured sections
  - Implement responsive layout for pillar topic and cluster topics
  - Add syntax highlighting for keywords and recommendations
  - Create collapsible sections for better readability
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3_

- [x] 5. Create signup CTA component
  - Build `SignupCTA` component with compelling messaging
  - Add prominent call-to-action button linking to Topicowl signup
  - Include value proposition text connecting strategy to article creation
  - Design eye-catching layout that encourages conversion
  - Add preview of how articles could be created from clusters
  - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.5_

- [x] 6. Create main SEO cluster map page
  - Build `/tools/seo-cluster-map/page.tsx` as a public page (no authentication required)
  - Integrate URL input form, progress tracking, strategy display, and signup CTA
  - Implement state management for the analysis workflow
  - Add proper error boundaries and fallback UI
  - Ensure the page works without any authentication checks
  - _Requirements: 4.1, 4.3, 5.4, 5.6_

- [x] 7. Add strategy export functionality
  - Create `StrategyExport` component with copy-to-clipboard option
  - Implement copy-to-clipboard functionality for strategy text
  - Include proper formatting for copied content
  - Add success feedback for copy actions
  - Remove download functionality to encourage signup for full features
  - _Requirements: 4.4_

- [x] 8. Implement rate limiting using simple in-memory solution
  - Implement simple in-memory rate limiting for 3 requests per hour per IP
  - Add rate limit check to API route with proper IP detection
  - Return 429 status code with proper error message when rate limit exceeded
  - Include messaging that encourages signup for unlimited access
  - Handle rate limit errors gracefully in frontend components
  - _Requirements: 5.5, 7.4_

- [x] 9. Complete implementation and testing
  - All core functionality has been implemented and is working
  - SEO Cluster Map tool is accessible at `/tools/seo-cluster-map` as a standalone public tool
  - No navigation integration needed as this is a public lead generation tool
  - _Requirements: 5.6_

- [x] 10. Improve strategy parsing and markdown rendering
  - Enhance strategy parsing logic to better handle AI-generated content variations
  - Implement ReactMarkdown for proper markdown rendering of strategy reports
  - Add fallback parsing for different content structures
  - Improve topic count extraction for accurate CTA display
  - Add complete strategy report section with collapsible markdown view
  - _Requirements: 3.1, 3.2, 3.3, 4.3_
