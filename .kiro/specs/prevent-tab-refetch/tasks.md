# Implementation Plan

- [x] 1. Create session management utility
  - Create utility functions for managing session state and preventing duplicate fetches
  - Implement session ID generation and storage management
  - Add helper functions for checking session initialization status
  - _Requirements: 1.2, 2.1, 3.4_

- [x] 2. Update OnboardingChecker to prevent tab refetch
  - Add session storage check before making onboarding status API call
  - Remove pathname dependency from useEffect that triggers on navigation
  - Implement session-based caching for onboarding status
  - Only fetch onboarding status once per browser session
  - _Requirements: 1.1, 3.1, 4.3_

- [x] 3. Modify ProjectProvider to eliminate re-initialization
  - Add session initialization flag to prevent multiple project loads
  - Modify useEffect dependencies to remove triggers on tab focus
  - Implement session-based project loading that only occurs on first mount
  - Preserve existing explicit refresh functionality
  - _Requirements: 1.1, 2.1, 3.2_

- [x] 4. Update useCredits hook to prevent automatic refetch
  - Add session-based fetch prevention logic
  - Only fetch credits on initial mount if not already fetched in session
  - Maintain explicit refreshCredits method for user-initiated updates
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 5. Remove tab visibility and focus event listeners
  - Audit all components for visibility change listeners that trigger data fetching
  - Remove focus event handlers that cause automatic refetching
  - Keep only necessary storage event listeners for cross-tab communication
  - Ensure no useEffect dependencies trigger on tab switches
  - _Requirements: 1.1, 3.4_

- [x] 6. Test and validate no refetch behavior
  - Test tab switching multiple times without network calls
  - Verify initial page load still fetches all required data
  - Test explicit refresh buttons and user actions still work
  - Validate session data persistence and cleanup
  - _Requirements: 1.3, 2.3, 4.1, 4.4_

## Reddit Page Tab Refetch Fix - December 2024

### Problem Identified ✅
- Reddit dashboard page (`/dashboard/reddit`) was refreshing data when tab lost/gained focus
- Root cause: useEffect hooks with callback dependencies that were recreated when `currentProject` object reference changed

### Solution Implemented ✅
- **Updated useEffect dependencies**: Removed callback functions from dependency arrays, used stable `currentProject?.id` directly
- **Updated callback functions**: Removed `currentProject?.id` from dependency arrays, functions now capture current value at execution time
- **Functions modified**:
  - `loadProfile`
  - `loadSubscriptions` 
  - `loadScheduledPosts`
  - `handleSearch`
  - `handleFetchPosts`
  - `handleDeletePost`
  - `searchSubredditsForForm`

### Testing Required
- [ ] Manual testing: Open Reddit page, switch tabs, verify no refetch
- [ ] Verify project switching still works
- [ ] Verify initial load works
- [ ] Check browser dev tools for unnecessary API calls

### Key Principle Applied
Applied the same pattern as the articles page:
- **Used `useCurrentProjectId()` hook** instead of `useProject().currentProject` for more stable references
- **Updated all callback dependencies** to use the stable `currentProjectId` 
- **Updated useEffect hooks** to use stable dependencies that don't recreate on tab focus
- **Followed articles page pattern** which successfully prevents tab refetch behavior

### Final Implementation ✅
- Replaced `useProject()` with `useCurrentProjectId()` hook
- Updated all references from `currentProject?.id` to `currentProjectId`
- Updated all callback dependency arrays to use stable `currentProjectId`
- Applied same pattern as WorkflowDashboard component which doesn't refetch on tab focus