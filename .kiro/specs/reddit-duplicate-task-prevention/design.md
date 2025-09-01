# Design Document

## Overview

The Reddit duplicate task prevention system will integrate with the existing task generation workflow to track processed Reddit posts and prevent duplicate task creation. The solution leverages the existing `redditProcessedPosts` table with its unique constraint on `(projectId, postId)` to ensure data integrity and prevent race conditions.

## Architecture

The duplicate prevention system will be implemented as a filtering layer within the existing `/api/reddit/tasks/generate` endpoint. The flow will be:

1. **Fetch Reddit Posts** - Existing logic remains unchanged
2. **Filter Duplicates** - New step to check against `redditProcessedPosts` table
3. **Evaluate Posts** - Existing AI evaluation on filtered posts only
4. **Generate Tasks** - Existing task creation logic
5. **Record Processed Posts** - New step to track posts in database

This approach minimizes changes to existing code while adding the duplicate prevention functionality.

## Components and Interfaces

### Database Layer

**Existing Table Usage:**
- `redditProcessedPosts` table with unique constraint on `(projectId, postId)`
- Fields used: `projectId`, `postId`, `subreddit`, `postTitle`, `postUrl`, `processedAt`

**New Database Operations:**
```typescript
// Check for existing processed posts
async function getExistingProcessedPosts(
  projectId: number, 
  postIds: string[]
): Promise<Set<string>>

// Record newly processed posts
async function recordProcessedPosts(
  projectId: number, 
  posts: RedditPost[]
): Promise<void>
```

### Core Logic Components

**Duplicate Filter Service:**
```typescript
interface DuplicateFilterResult {
  newPosts: RawRedditPost[];
  duplicateCount: number;
  duplicatePosts: Array<{
    postId: string;
    title: string;
    subreddit: string;
  }>;
}

async function filterDuplicatePosts(
  projectId: number,
  posts: RawRedditPost[]
): Promise<DuplicateFilterResult>
```

**Post Recording Service:**
```typescript
interface ProcessedPostRecord {
  projectId: number;
  postId: string;
  subreddit: string;
  postTitle: string;
  postUrl: string;
}

async function recordProcessedPosts(
  records: ProcessedPostRecord[]
): Promise<void>
```

## Data Models

### Reddit Post ID Format
Reddit post IDs follow the format `t3_<base36_id>` where:
- `t3_` indicates a "link" type post
- The base36 ID is extracted from the Reddit API response

### Processed Post Tracking
```typescript
interface ProcessedPostData {
  projectId: number;
  postId: string; // Format: "t3_abc123"
  subreddit: string; // Format: "programming" (without r/ prefix)
  postTitle: string;
  postUrl: string; // Full Reddit URL
  processedAt: Date;
}
```

## Error Handling

### Database Constraint Violations
- Use `INSERT ... ON CONFLICT DO NOTHING` pattern for race condition safety
- Log constraint violations as informational (expected behavior)
- Continue processing even if some posts fail to record

### Database Unavailability
- Wrap duplicate checking in try-catch blocks
- Log warnings when duplicate checking fails
- Fall back to processing all posts (existing behavior)
- Ensure task generation doesn't fail due to duplicate checking issues

### Empty Result Sets
- When all posts are duplicates, return clear error message
- Include statistics about how many posts were filtered
- Suggest user actions (wait for new posts, adjust subreddit selection)

## Testing Strategy

### Unit Tests
1. **Duplicate Detection Logic**
   - Test filtering with various combinations of new/duplicate posts
   - Verify correct post ID extraction and formatting
   - Test edge cases (empty arrays, malformed post IDs)

2. **Database Operations**
   - Test batch duplicate checking with large post sets
   - Test batch insertion with constraint violations
   - Test error handling for database failures

3. **Integration Points**
   - Test integration with existing task generation flow
   - Verify AI evaluation only runs on filtered posts
   - Test response format includes duplicate statistics

### Integration Tests
1. **End-to-End Task Generation**
   - Generate tasks for new posts, verify they're recorded
   - Re-run generation, verify duplicates are filtered
   - Test with mixed new/duplicate post sets

2. **Error Scenarios**
   - Test behavior when database is unavailable
   - Test constraint violation handling
   - Test recovery from partial failures

### Performance Tests
1. **Large Dataset Handling**
   - Test duplicate checking with 100+ posts
   - Measure query performance with large `redditProcessedPosts` table
   - Verify batch operations scale appropriately

## Implementation Notes

### Post ID Extraction
Reddit API returns post IDs in different formats:
- Full name: `t3_abc123` (preferred for storage)
- Short ID: `abc123` (may appear in some API responses)
- Ensure consistent normalization to `t3_` format

### Batch Operations
- Use `IN` clause for duplicate checking (limit to reasonable batch sizes)
- Use batch insertion for recording processed posts
- Consider chunking for very large post sets (>100 posts)

### Logging and Monitoring
- Log duplicate filtering statistics at INFO level
- Log database errors at WARN level
- Include post titles in debug logs for troubleshooting
- Track metrics: duplicate rate, processing time, error rates

### Backward Compatibility
- Existing task generation behavior unchanged when no duplicates exist
- No breaking changes to API response format
- Graceful degradation when duplicate prevention fails