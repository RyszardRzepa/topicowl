# Prevent Tab Refetch on Focus - Reddit Dashboard

## Problem Statement

The `/dashboard/reddit` page refreshes/refetches data when the browser tab loses focus and then regains focus. This causes unnecessary API calls and poor user experience.

## Root Cause Analysis

The issue stems from a chain of re-renders triggered by tab focus changes:

1. **Clerk's `useUser` hook** may re-trigger when tab regains focus
2. This causes the **ProjectContext** to re-initialize 
3. The `currentProject` object reference changes (even if the ID is the same)
4. **Reddit page's useEffect hooks** have dependencies on callback functions that depend on `currentProject?.id`
5. When `currentProject` reference changes, the callbacks are recreated
6. This triggers the useEffect hooks to run again, causing API refetches

### Specific Code Locations

**Reddit Page (`src/app/dashboard/reddit/page.tsx`)**:
```typescript
// These useEffect hooks are triggered by callback recreation
useEffect(() => {
  if (currentProject?.id) {
    void loadProfile();
  }
}, [loadProfile, currentProject?.id]); // loadProfile recreated when currentProject changes

useEffect(() => {
  if (isConnected) {
    void loadSubscriptions();
    void loadScheduledPosts();
  }
}, [isConnected, loadSubscriptions, loadScheduledPosts]); // callbacks recreated
```

**Callback Dependencies**:
```typescript
const loadProfile = useCallback(async () => {
  // ... implementation
}, [setLoading, currentProject?.id]); // Recreated when currentProject changes

const loadSubscriptions = useCallback(async () => {
  // ... implementation  
}, [setLoading, isConnected, currentProject?.id]); // Recreated when currentProject changes
```

## Solution Strategy

### Option 1: Stabilize Dependencies (Recommended)
- Use `currentProject?.id` directly in useEffect dependencies instead of callback functions
- Remove callback functions from useEffect dependencies where possible
- Use `useRef` to track if initial load has completed

### Option 2: Session-Based Deduplication
- Use the existing session management utilities in `src/constants.ts`
- Track initialization state per session to prevent duplicate fetches

### Option 3: Debounce/Throttle
- Add debouncing to prevent rapid successive calls
- Less ideal as it doesn't address root cause

## Implementation Plan

### Phase 1: Fix Reddit Page Dependencies
1. Refactor useEffect hooks to not depend on callback functions
2. Use stable dependencies like `currentProject?.id` directly
3. Add session-based initialization tracking

### Phase 2: Audit Other Pages
1. Check other dashboard pages for similar patterns
2. Apply same fixes where needed

### Phase 3: Prevent Future Issues
1. Add ESLint rule or documentation about stable dependencies
2. Update development guidelines

## Success Criteria

- [ ] Reddit page does not refetch data when tab loses/gains focus
- [ ] Initial page load still works correctly
- [ ] Project switching still triggers appropriate refetches
- [ ] No regression in other functionality
- [ ] Solution is maintainable and documented

## Technical Implementation

### Files to Modify
- `src/app/dashboard/reddit/page.tsx` - Main fix
- Potentially other dashboard pages with similar patterns

### Testing Approach
1. Manual testing: Open Reddit page, switch tabs, verify no refetch
2. Verify project switching still works
3. Verify initial load works
4. Check browser dev tools for unnecessary API calls