# Implementation Plan

- [x] 1. Set up article preview page route and basic structure
  - Create `/src/app/articles/[id]/page.tsx` with server component for initial data fetching
  - Implement basic page layout with navigation back to kanban board
  - Add proper TypeScript interfaces for page props and article data
  - _Requirements: 1.1, 4.1, 4.3_

- [x] 2. Enhance article API endpoint for preview data
  - Extend `/src/app/api/articles/[id]/route.ts` to include SEO analysis and generation logs
  - Add ArticleDetailResponse type with extended article data
  - Implement error handling for article not found scenarios
  - _Requirements: 1.2, 2.1, 2.2, 2.3_

- [x] 3. Refactor page into modular components
  - Extract article content display into `/src/components/articles/article-preview.tsx`
  - Extract metadata display into `/src/components/articles/article-metadata.tsx`
  - Extract generation status into `/src/components/articles/generation-status.tsx`
  - Update page to use new modular components
  - _Requirements: 1.2, 2.1, 5.1, 5.4_

- [x] 4. Create ArticleActions component with management buttons
  - Build `/src/components/articles/article-actions.tsx` with edit, regenerate, schedule, and delete buttons
  - Use existing API endpoints: `/api/articles/[id]/generate`, `/api/articles/[id]/schedule`, `/api/articles/[id]` (DELETE)
  - Import colocated types from API routes for type safety
  - Add confirmation dialogs for destructive actions
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 5. Implement inline editing functionality
  - Add inline editing capability to ArticlePreview component for title and content
  - Use existing `/api/articles/[id]` PUT endpoint with proper validation schema
  - Create auto-save functionality with debounced API calls
  - Implement edit mode toggle and content validation
  - _Requirements: 3.2, 3.5_

- [x] 6. Integrate ArticleActions component into preview page
  - Add ArticleActions component to the article preview page layout
  - Connect action handlers to update article state and refresh UI
  - Implement proper error handling and success feedback
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Add real-time generation status polling
  - Use existing `/api/articles/[id]/generation-status` endpoint for status updates
  - Implement polling mechanism for articles in "generating" status
  - Update UI components when generation status changes using progress tracker
  - Add progress indicators and status updates
  - _Requirements: 1.3, 1.4_

- [ ] 8. Enhance SEO metadata display with detailed analysis
  - Update ArticleMetadata component to show detailed SEO analysis from API
  - Display keyword density, readability score, and SEO recommendations
  - Add visual indicators for SEO score and optimization status
  - Show generation logs and research sources
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 9. Add kanban board navigation integration
  - Make kanban cards clickable to navigate to article preview page
  - Ensure proper navigation state and back button functionality
  - Update kanban board to reflect article status changes from preview page
  - Test navigation flow and state preservation
  - _Requirements: 1.1, 4.1, 4.2, 4.4_

- [ ] 10. Enhance error handling and loading states
  - Improve error display for generation failures
  - Add loading skeletons for initial page load
  - Add toast notifications for API failures and success messages
  - Handle edge cases like network timeouts and server errors
  - _Requirements: 1.4, 4.3_

- [ ] 11. Add accessibility features and ARIA support
  - Implement keyboard navigation for all interactive elements
  - Add proper ARIA labels and semantic HTML structure
  - Ensure screen reader compatibility and focus management
  - Test with screen readers and keyboard-only navigation
  - _Requirements: 5.2, 5.3_

- [ ] 12. Optimize for mobile responsiveness
  - Improve mobile layout and touch-friendly interactions
  - Optimize typography and spacing for mobile devices
  - Test responsive design across different screen sizes
  - Ensure action buttons are properly sized for touch
  - _Requirements: 5.1, 5.4_

- [ ] 13. Write unit tests for all components
  - Create tests for ArticlePreview, ArticleMetadata, and ArticleActions components
  - Test GenerationStatus component with various status scenarios
  - Add tests for error handling and navigation functionality
  - Test inline editing and auto-save functionality
  - _Requirements: All requirements validation_

- [ ] 14. Implement integration tests for page functionality
  - Test complete navigation flow from kanban to preview and back
  - Test article actions (edit, regenerate, schedule, delete) end-to-end
  - Verify real-time status updates and error handling
  - Test responsive design and accessibility compliance
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4_

- [ ] 15. Add performance optimizations and caching
  - Implement client-side caching for article data
  - Add lazy loading for non-critical components
  - Optimize bundle size and implement code splitting
  - Add proper loading states and skeleton screens
  - _Requirements: 5.4_

- [ ] 16. Final testing and polish
  - Conduct end-to-end testing of complete user journey
  - Test accessibility compliance and responsive design
  - Perform performance testing and optimization
  - Polish UI/UX details and animations
  - _Requirements: All requirements validation_
