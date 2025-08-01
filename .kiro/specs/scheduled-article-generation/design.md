# Design Document

## Overview

The scheduled article generation system extends the existing Contentbot with automated scheduling capabilities. Users can create article ideas, set scheduling frequencies for when articles should be added to the generation queue, and control the generation pipeline. The system automatically processes articles from the queue one at a time until the queue is empty, generating content and saving it as drafts.

This feature integrates seamlessly with the existing tab-based workflow, adding new tabs and scheduling controls while maintaining the current interface and generation pipeline.

## Architecture

### Scheduling Philosophy

The system supports two types of scheduling that work together:

1. **Automatic Scheduling**: Users set frequency rules (e.g., "1 article per day") that automatically add articles to the queue
2. **Manual Override**: Users can manually schedule additional articles for any date, overriding automatic limits

**Key Principle**: Manual scheduling always takes precedence and adds to (not replaces) automatic scheduling. If a user sets "1 article per day" but manually schedules 2 additional articles for the same day, the system will process all 3 articles.

### Database Schema Extensions

The existing `articles` table will be extended with scheduling-related fields:

```sql
-- Add to existing articles table
ALTER TABLE articles ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE; -- When to add to queue
ALTER TABLE articles ADD COLUMN scheduling_type VARCHAR(20) DEFAULT 'manual'; -- 'manual', 'automatic'
ALTER TABLE articles ADD COLUMN scheduling_frequency VARCHAR(20); -- 'once', 'daily', 'weekly', 'monthly' (for automatic only)
ALTER TABLE articles ADD COLUMN scheduling_frequency_config JSONB; -- Store frequency details (for automatic only)
ALTER TABLE articles ADD COLUMN next_schedule_at TIMESTAMP WITH TIME ZONE; -- Next time to add to queue (for automatic only)
ALTER TABLE articles ADD COLUMN last_scheduled_at TIMESTAMP WITH TIME ZONE; -- Last time added to queue
ALTER TABLE articles ADD COLUMN schedule_count INTEGER DEFAULT 0; -- How many times scheduled
ALTER TABLE articles ADD COLUMN is_recurring_schedule BOOLEAN DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN parent_article_id INTEGER REFERENCES articles(id); -- For recurring schedules
```

New table for tracking scheduled generation queue:

```sql
CREATE TABLE generation_queue (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) NOT NULL,
  user_id TEXT REFERENCES users(id) NOT NULL,
  added_to_queue_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  scheduled_for_date DATE, -- The date this article was scheduled for (for tracking purposes)
  queue_position INTEGER, -- Order in queue (FIFO)
  scheduling_type VARCHAR(20) DEFAULT 'manual', -- 'manual', 'automatic' (how it was added)
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_generation_queue_position ON generation_queue(queue_position);
CREATE INDEX idx_generation_queue_status ON generation_queue(status);
CREATE INDEX idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX idx_generation_queue_scheduled_date ON generation_queue(scheduled_for_date);
```

### Status Flow Enhancement

The existing tab-based workflow will be enhanced with new statuses:

```
Current: idea → to_generate → generating → wait_for_publish → published
Enhanced: idea → scheduled → queued → generating → wait_for_publish → published
```

**Tab Organization:**

- **Ideas Tab**: Articles in 'idea' status
- **Scheduled Tab**: Articles with generation schedules set ('scheduled' status)
- **Generation Queue Tab**: Articles moved to generation queue ('queued' status)
- **Generating Tab**: Currently being processed ('generating' status)
- **Ready to Publish Tab**: Generated and ready for review ('wait_for_publish' status)
- **Published Tab**: Published articles ('published' status)

## Components and Interfaces

### 1. Article Scheduling Interface

**Location**: Enhanced `ArticleCard` component in tab-based workflow

**Features**:

- Date/time picker for generation scheduling
- Frequency selection (one-time, daily, weekly, monthly)
- Advanced frequency options (specific days, times)
- Schedule preview and validation
- Action buttons that trigger status changes and notifications

**API Integration**:

```typescript
// POST /api/articles/schedule
interface ScheduleArticleRequest {
  articleId: number;
  scheduledAt: string; // When to add to queue (ISO date string)
  schedulingType: "manual" | "automatic";
  frequency?: "once" | "daily" | "weekly" | "monthly"; // Required for automatic, ignored for manual
  frequencyConfig?: {
    daysOfWeek?: number[]; // 0-6, Sunday=0
    timeOfDay?: string; // HH:MM format
    monthlyDay?: number; // 1-31 for monthly
    timezone?: string;
  };
}

// POST /api/articles/add-to-queue (for immediate manual queue addition)
interface AddToQueueRequest {
  articleId: number;
  scheduledForDate?: string; // Optional date for tracking (defaults to today)
}

// DELETE /api/articles/generation-queue/[id] (remove item from queue)
interface RemoveFromQueueRequest {
  queueItemId: number;
}
```

### 2. Generation Queue Management

**Location**: New "Generation Queue" tab in Content Workflow section

**Features**:

- Display articles ordered by scheduled generation time
- Show next generation time for each article
- Manual queue management (add/remove articles)
- Queue status indicators
- Tab badge showing queue count

**API Integration**:

```typescript
// GET /api/articles/generation-queue
interface GenerationQueueResponse {
  articles: Array<{
    id: number; // queue item id
    articleId: number;
    title: string;
    addedToQueueAt: string;
    scheduledForDate: string;
    queuePosition: number;
    schedulingType: "manual" | "automatic";
    status: "queued" | "processing" | "completed" | "failed";
  }>;
  totalCount: number;
  currentlyProcessing?: number; // article id currently being processed
}
```

### 3. Automated Generation Processor

**Location**: Enhanced cron job at `/api/cron/generate-articles`

**Features**:

- Add scheduled articles to generation queue when their time arrives
- Process articles from generation queue one at a time
- Handle recurring generation schedules
- Error handling and retry logic
- Queue management and status updates

**Processing Logic**:

**Phase 1: Add Articles to Queue**

1. Check for articles with `next_schedule_at <= NOW()` and `scheduling_type = 'automatic'`
2. Add these articles to generation_queue with `scheduling_type = 'automatic'`
3. Calculate next `next_schedule_at` for recurring schedules
4. Manual articles are added to queue immediately when user triggers the action

**Phase 2: Process Queue**

1. Process articles from generation_queue one at a time in FIFO order (by queue_position)
2. Update article status to 'generating'
3. Call existing generation pipeline
4. Handle success/failure and update records
5. Continue until queue is empty

**Key Design Principle**: The queue processes ALL articles regardless of how they were added (manual or automatic). There are no daily limits on processing - if 5 articles are in the queue for the same day, all 5 will be processed.

### 4. Schedule Management Dashboard

**Location**: New section in existing tab-based workflow

**Features**:

- Overview of all scheduled generations
- Bulk schedule management
- Schedule modification and cancellation
- Generation history and analytics

### 5. Flexible Scheduling System

**Automatic Scheduling**:

- Users can set frequency rules (e.g., "1 article per day at 9 AM")
- System automatically adds articles to queue based on these rules
- Recurring schedules calculate next occurrence automatically

**Manual Override**:

- Users can manually schedule additional articles for any date/time
- Manual scheduling bypasses automatic frequency limits
- Multiple articles can be manually scheduled for the same day

**Example Scenario**:

- User sets automatic schedule: "1 article per day at 9 AM"
- User manually schedules 2 additional articles for today
- Result: 3 articles will be processed today (1 automatic + 2 manual)

**Queue Processing**:

- All articles in queue are processed regardless of source (manual/automatic)
- No daily limits on processing - queue processes until empty
- FIFO order ensures predictable processing sequence

### 6. Notification System

**Location**: Toast notifications and status updates throughout the interface

**Features**:

- Success notifications when articles move between tabs/statuses
- Error notifications for failed operations
- Progress notifications for ongoing operations
- Status change confirmations with clear messaging

## Data Models

### Enhanced Article Model

```typescript
interface ScheduledArticle extends Article {
  scheduledAt?: string; // When to add to queue
  schedulingType: "manual" | "automatic";
  schedulingFrequency?: "once" | "daily" | "weekly" | "monthly"; // Only for automatic
  schedulingFrequencyConfig?: {
    daysOfWeek?: number[];
    timeOfDay?: string;
    monthlyDay?: number;
    timezone?: string;
  };
  nextScheduleAt?: string; // Next time to add to queue (automatic only)
  lastScheduledAt?: string; // Last time added to queue
  scheduleCount: number;
  isRecurringSchedule: boolean;
  parentArticleId?: number;
}
```

### Scheduled Generation Model

```typescript
interface GenerationQueueItem {
  id: number;
  articleId: number;
  userId: string;
  addedToQueueAt: string;
  scheduledForDate: string; // The date this was scheduled for (tracking)
  queuePosition: number;
  schedulingType: "manual" | "automatic"; // How it was added to queue
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  completedAt?: string;
}
```

## Error Handling

### Generation Failures

1. **Retry Logic**: Implement exponential backoff for failed generations
2. **Error Logging**: Detailed error tracking in `scheduled_generations` table
3. **User Notification**: Update article status and show error messages in UI
4. **Queue Continuity**: Failed generations don't block subsequent items

### Schedule Conflicts

1. **Validation**: Prevent scheduling in the past or invalid frequencies
2. **Capacity Management**: Limit concurrent generations to prevent resource exhaustion
3. **Queue Overflow**: Handle scenarios where queue becomes too large

### System Recovery

1. **Restart Handling**: Resume processing from last known state after system restart
2. **Orphaned Records**: Clean up incomplete generation records
3. **Data Consistency**: Ensure article status matches generation record status

## Testing Strategy

### Unit Tests

1. **Scheduling Logic**: Test frequency calculations and next generation time computation
2. **Queue Processing**: Test article selection and processing order
3. **Error Handling**: Test retry logic and failure scenarios
4. **Data Validation**: Test input validation for scheduling parameters

### Integration Tests

1. **End-to-End Scheduling**: Test complete flow from schedule creation to article generation
2. **Cron Job Processing**: Test automated queue processing
3. **API Endpoints**: Test all new API routes with various scenarios
4. **Database Operations**: Test schema changes and data migrations

### Performance Tests

1. **Queue Processing**: Test performance with large numbers of scheduled articles
2. **Concurrent Generation**: Test system behavior with multiple simultaneous generations
3. **Database Queries**: Test query performance for scheduling operations

### User Acceptance Tests

1. **Scheduling Interface**: Test user experience for creating and managing schedules
2. **Queue Management**: Test drag-and-drop functionality with new columns
3. **Error Recovery**: Test user experience when generations fail
4. **Schedule Modification**: Test editing and canceling scheduled generations

## Implementation Phases

### Phase 1: Database and Core API

- Extend database schema with scheduling fields
- Create core scheduling API endpoints
- Implement basic queue management

### Phase 2: UI Integration

- Add scheduling controls to kanban board
- Create generation queue column
- Implement schedule management interface

### Phase 3: Automated Processing

- Enhance cron job for automated generation
- Implement retry logic and error handling
- Add recurring generation support

### Phase 4: Advanced Features

- Add bulk scheduling operations
- Implement schedule analytics
- Add advanced frequency options

## Security Considerations

1. **User Authorization**: Ensure users can only schedule their own articles
2. **Input Validation**: Validate all scheduling parameters on server side
3. **Rate Limiting**: Prevent abuse of scheduling API endpoints
4. **Resource Protection**: Limit concurrent generations per user

## Performance Considerations

1. **Database Indexing**: Add indexes for efficient queue queries
2. **Cron Job Optimization**: Process queue efficiently without blocking
3. **Memory Management**: Handle large queues without memory issues
4. **API Response Times**: Ensure scheduling operations are responsive
