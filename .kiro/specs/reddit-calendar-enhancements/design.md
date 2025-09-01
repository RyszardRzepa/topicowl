# Design Document

## Overview

This design enhances the Reddit task calendar with two key improvements: week-specific task generation and Google Calendar-style overlapping task visualization. The solution builds upon the existing TaskCalendar component and task generation API to provide better user experience and visual clarity.

## Architecture

### Component Structure
```
TaskCalendar (Enhanced)
├── Header Section
│   ├── Navigation Controls (existing)
│   └── Generate Tasks Button (replaces Refresh)
├── Calendar Grid (Enhanced)
│   ├── Time Column (existing)
│   └── Day Columns (enhanced with overlap handling)
│       ├── Day Header (existing)
│       └── Task Rendering (enhanced with stacking)
└── Modals (existing)
```

### Data Flow
```
User clicks "Generate Tasks" 
→ TaskCalendar determines current week
→ API call with weekStartDate parameter
→ Task generation for specific week
→ Calendar refresh with new tasks
→ Visual overlap detection and rendering
```

## Components and Interfaces

### Enhanced TaskCalendar Component

**New Props:**
```typescript
interface TaskCalendarProps {
  // ... existing props
  currentWeekStart?: Date; // For determining generation week
}
```

**New State:**
```typescript
interface TaskCalendarState {
  // ... existing state
  isGeneratingTasks: boolean;
  currentWeekStart: Date;
}
```

### Task Generation Button

**Component Interface:**
```typescript
interface GenerateTasksButtonProps {
  projectId: number;
  weekStartDate: Date;
  onTasksGenerated: () => void;
  disabled?: boolean;
}
```

**Button States:**
- Default: "Generate This Week's Tasks"
- Loading: "Generating..." with spinner
- Disabled: When no project or already generating

### Overlapping Task Visualization

**Overlap Detection Algorithm:**
```typescript
interface TaskOverlap {
  taskId: number;
  overlapGroup: number;
  stackIndex: number;
  totalInStack: number;
}

function detectOverlaps(tasks: RedditTask[]): TaskOverlap[] {
  // Group tasks by time slot
  // Calculate overlap relationships
  // Assign stack positions
}
```

**Visual Positioning:**
```typescript
interface TaskPosition {
  top: string;
  height: string;
  left: string;    // New: for horizontal offset
  width: string;   // New: for width adjustment
  zIndex: number;  // New: for layering
}
```

## Data Models

### Enhanced API Request
```typescript
interface GenerateTasksRequest {
  projectId: number;
  weekStartDate: string; // ISO date string for specific week
}
```

### Enhanced API Response
```typescript
interface GenerateTasksResponse {
  success: boolean;
  tasksGenerated: number;
  weekStartDate: string;
  taskDistribution: {
    comments: number;
    posts: number;
    commentRatio: number;
    expectedRatio: number;
  };
  // ... existing statistics
}
```

### Task Overlap Data Structure
```typescript
interface TaskWithOverlap extends RedditTask {
  overlapInfo?: {
    groupId: string;
    stackIndex: number;
    totalInGroup: number;
  };
}
```

## Error Handling

### Task Generation Errors
1. **No Project Selected**: Show error toast, disable button
2. **Network Failure**: Show retry option, re-enable button
3. **Server Error**: Display error message from API response
4. **Existing Tasks**: Show confirmation dialog for regeneration

### Overlap Rendering Errors
1. **Invalid Task Times**: Fallback to default positioning
2. **Too Many Overlaps**: Show count indicator (3+)
3. **Rendering Performance**: Virtualization for large task sets

## Testing Strategy

### Unit Tests
1. **Overlap Detection Algorithm**
   - Test with no overlaps
   - Test with 2-task overlap
   - Test with multiple overlapping groups
   - Test with partial overlaps

2. **Task Generation Button**
   - Test disabled states
   - Test loading states
   - Test success/error handling

3. **Week Calculation**
   - Test current week detection
   - Test week navigation impact
   - Test timezone handling

### Integration Tests
1. **End-to-End Task Generation**
   - Generate tasks for current week
   - Verify API call parameters
   - Verify UI updates

2. **Visual Overlap Rendering**
   - Create overlapping tasks
   - Verify stacking appearance
   - Test interaction with overlapped tasks

### Visual Regression Tests
1. **Calendar Layout**
   - Compare before/after screenshots
   - Test different screen sizes
   - Test with various task densities

## Implementation Details

### Overlap Detection Logic
```typescript
function calculateTaskOverlaps(tasks: RedditTask[]): Map<number, TaskOverlap> {
  const overlaps = new Map<number, TaskOverlap>();
  const timeSlots = new Map<string, RedditTask[]>();
  
  // Group tasks by hour slot
  tasks.forEach(task => {
    const hour = new Date(task.scheduledDate).getHours();
    const slotKey = hour.toString();
    if (!timeSlots.has(slotKey)) {
      timeSlots.set(slotKey, []);
    }
    timeSlots.get(slotKey)!.push(task);
  });
  
  // Calculate overlap positions
  timeSlots.forEach((slotTasks, slotKey) => {
    if (slotTasks.length > 1) {
      slotTasks.forEach((task, index) => {
        overlaps.set(task.id, {
          taskId: task.id,
          overlapGroup: parseInt(slotKey),
          stackIndex: index,
          totalInStack: slotTasks.length
        });
      });
    }
  });
  
  return overlaps;
}
```

### Visual Stacking CSS
```css
.task-card {
  position: absolute;
  transition: all 0.2s ease;
}

.task-card.stacked {
  transform: translateX(var(--stack-offset));
  width: calc(100% - var(--stack-offset));
  z-index: var(--stack-index);
}

.task-card.stacked:hover {
  z-index: 999;
  transform: translateX(0);
  width: 100%;
}
```

### Week-Specific Generation
```typescript
function getCurrentWeekStart(referenceDate?: Date): Date {
  const date = referenceDate || new Date();
  const day = date.getDay();
  const diff = date.getDate() - day; // Sunday = 0
  return new Date(date.setDate(diff));
}

function generateTasksForWeek(weekStart: Date, projectId: number) {
  return fetch('/api/reddit/tasks/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      weekStartDate: weekStart.toISOString()
    })
  });
}
```

## Performance Considerations

### Rendering Optimization
- Use React.memo for task cards to prevent unnecessary re-renders
- Implement virtual scrolling for weeks with many tasks
- Debounce overlap calculations during drag operations

### API Optimization
- Cache week data to avoid redundant API calls
- Implement optimistic updates for task movements
- Use request deduplication for rapid button clicks

## Accessibility

### Keyboard Navigation
- Tab through overlapped tasks in logical order
- Provide keyboard shortcuts for task generation
- Ensure screen readers can identify overlapping tasks

### Visual Indicators
- Use distinct colors for different overlap levels
- Provide text alternatives for visual stacking
- Maintain sufficient contrast ratios for stacked tasks

## Browser Compatibility

### CSS Features
- CSS Grid for calendar layout (IE11+)
- CSS Custom Properties for dynamic positioning (IE11+)
- Transform and transition animations (IE10+)

### JavaScript Features
- Date manipulation with date-fns library
- Fetch API with polyfill for older browsers
- ES6+ features transpiled via Next.js