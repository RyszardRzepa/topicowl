# Requirements Document

## Introduction

The Reddit task generation system currently creates duplicate tasks for the same Reddit posts across multiple generation runs. This leads to inefficient use of resources and potential spam-like behavior when users engage with the same posts multiple times. The system needs to implement duplicate prevention by tracking processed Reddit posts and excluding them from future task generation.

## Requirements

### Requirement 1

**User Story:** As a content manager, I want the system to prevent creating tasks for Reddit posts that have already been processed, so that I don't waste time and credits on duplicate engagement.

#### Acceptance Criteria

1. WHEN the system fetches Reddit posts for task generation THEN it SHALL check the `redditProcessedPosts` table for existing records
2. WHEN a Reddit post already exists in `redditProcessedPosts` for the same project THEN the system SHALL exclude it from task generation
3. WHEN the system creates tasks from Reddit posts THEN it SHALL record each post in the `redditProcessedPosts` table
4. WHEN recording processed posts THEN the system SHALL store the Reddit post ID, subreddit, title, URL, and project association

### Requirement 2

**User Story:** As a system administrator, I want to ensure data integrity when preventing duplicates, so that the system handles edge cases gracefully without breaking.

#### Acceptance Criteria

1. WHEN checking for duplicate posts THEN the system SHALL use the unique constraint on `(projectId, postId)` to prevent race conditions
2. WHEN a database constraint violation occurs during insertion THEN the system SHALL handle it gracefully without failing the entire operation
3. WHEN the `redditProcessedPosts` table is unavailable THEN the system SHALL log a warning and continue with task generation
4. WHEN processing posts THEN the system SHALL use the Reddit post ID format (e.g., "t3_abc123") for consistent identification

### Requirement 3

**User Story:** As a developer, I want the duplicate prevention to be efficient and performant, so that task generation doesn't become slow with large datasets.

#### Acceptance Criteria

1. WHEN checking for duplicates THEN the system SHALL use a single database query to check all fetched posts at once
2. WHEN filtering posts THEN the system SHALL exclude duplicates before running AI evaluation to save API costs
3. WHEN the duplicate check query fails THEN the system SHALL fall back to processing all posts with a warning
4. WHEN inserting processed posts THEN the system SHALL use batch insertion for better performance

### Requirement 4

**User Story:** As a content manager, I want visibility into which posts were skipped due to duplication, so that I can understand why fewer tasks were generated than expected.

#### Acceptance Criteria

1. WHEN posts are filtered out due to duplication THEN the system SHALL log the count of duplicates found
2. WHEN returning the generation response THEN the system SHALL include statistics about duplicates filtered
3. WHEN no new posts are found after filtering THEN the system SHALL return a clear error message explaining the situation
4. WHEN logging duplicate information THEN the system SHALL include post titles and subreddits for debugging purposes