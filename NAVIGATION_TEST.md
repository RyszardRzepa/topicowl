# Navigation Integration Test Plan

## Test Cases

### 1. Card Click Navigation
- [ ] Click on any kanban card
- [ ] Verify navigation to `/articles/[id]` page
- [ ] Verify article content is displayed correctly
- [ ] Verify back button works and returns to kanban board

### 2. Interactive Elements Don't Navigate
- [ ] Click on edit button - should not navigate
- [ ] Click on delete button - should not navigate  
- [ ] Click on generate button - should not navigate
- [ ] Click on schedule button - should not navigate
- [ ] Click on input fields during editing - should not navigate

### 3. Back Navigation
- [ ] From article preview, click "Back to Kanban Board" button
- [ ] Verify return to main kanban board
- [ ] Verify kanban board state is preserved
- [ ] Use browser back button - should work correctly

### 4. Status Change Reflection
- [ ] From article preview, change article status (regenerate, schedule, etc.)
- [ ] Navigate back to kanban board
- [ ] Verify kanban board reflects the status change
- [ ] Verify article appears in correct column

### 5. Real-time Updates
- [ ] Open article in preview
- [ ] Change status from preview page
- [ ] Return to kanban board (via back button or browser back)
- [ ] Verify kanban board automatically refreshes and shows updated status

### 6. Visual Feedback
- [ ] Hover over kanban cards - should show hover effects
- [ ] Cards should have proper cursor states (grab for draggable, pointer for clickable)
- [ ] Title should show hover effect when hovering over card
- [ ] Breadcrumb navigation should be visible on article preview page

## Expected Behavior

1. **Card Navigation**: Clicking anywhere on a kanban card (except interactive elements) should navigate to the article preview page
2. **Back Navigation**: Back button and breadcrumb should return to kanban board
3. **State Preservation**: Kanban board should maintain its state when returning from article preview
4. **Status Updates**: Changes made in article preview should be reflected in kanban board
5. **Visual Feedback**: Clear visual indicators for clickable elements and hover states