# Requirements Document

## Introduction

The current database schema for article generation and management has several redundancies and design issues that make it complex to manage articles in the WorkflowDashboard. The schema includes overlapping fields between the `articles`, `articleGeneration`, and `generationQueue` tables, leading to data inconsistencies and complex queries. This feature aims to optimize the database schema to create a cleaner, more maintainable design that better supports the kanban-style workflow dashboard.

## Requirements

### Requirement 1

**User Story:** As a developer, I want a simplified database schema that eliminates redundant fields and tables, so that article management queries are more efficient and maintainable.

#### Acceptance Criteria

1. WHEN analyzing the current schema THEN the system SHALL identify all redundant fields between `articles`, `articleGeneration`, and `generationQueue` tables
2. WHEN consolidating tables THEN the system SHALL merge related functionality into appropriate tables to reduce complexity
3. WHEN querying articles for the workflow dashboard THEN the system SHALL require only simple queries without complex joins
4. IF fields serve the same purpose across tables THEN the system SHALL consolidate them into a single authoritative location

### Requirement 2

**User Story:** As a developer, I want generation tracking to be integrated directly into the articles table, so that I don't need complex joins to display article status and progress.

#### Acceptance Criteria

1. WHEN tracking article generation progress THEN the system SHALL store progress information directly in the articles table
2. WHEN displaying generation status THEN the system SHALL access status information without joining multiple tables
3. WHEN an article generation starts THEN the system SHALL update generation fields in the articles table directly
4. WHEN generation completes or fails THEN the system SHALL update the final status in the articles table without requiring separate tracking tables

### Requirement 3

**User Story:** As a developer, I want scheduling information to be consolidated and simplified, so that the workflow dashboard can easily display scheduled articles.

#### Acceptance Criteria

1. WHEN an article is scheduled for generation THEN the system SHALL store scheduling information in a single, clear location
2. WHEN displaying scheduled articles THEN the system SHALL access scheduling data without complex date field logic
3. WHEN managing recurring schedules THEN the system SHALL use a simplified scheduling model that's easy to query
4. IF an article has multiple scheduling types THEN the system SHALL use a unified scheduling approach

### Requirement 4

**User Story:** As a developer, I want the kanban workflow to be supported by clear status transitions, so that articles move predictably through the workflow stages.

#### Acceptance Criteria

1. WHEN an article changes status THEN the system SHALL ensure the status accurately reflects the article's current state
2. WHEN querying articles by status THEN the system SHALL return consistent results that match the workflow dashboard expectations
3. WHEN articles are in generation THEN the system SHALL provide clear progress and phase information
4. WHEN generation completes THEN the system SHALL automatically transition articles to the appropriate next status

### Requirement 5

**User Story:** As a developer, I want to eliminate the separate `generationQueue` table, so that queue management is simplified and integrated with the main articles workflow.

#### Acceptance Criteria

1. WHEN articles need to be queued for generation THEN the system SHALL use article status and scheduling fields instead of a separate queue table
2. WHEN processing the generation queue THEN the system SHALL query articles directly by status and schedule
3. WHEN tracking queue position THEN the system SHALL use article ordering fields or timestamps
4. WHEN handling generation failures THEN the system SHALL track retry attempts directly in the articles table

### Requirement 6

**User Story:** As a developer, I want content and metadata fields to be properly organized, so that the articles table structure is clean and logical.

#### Acceptance Criteria

1. WHEN storing article content THEN the system SHALL use clear field names that indicate content state (draft vs published)
2. WHEN managing article metadata THEN the system SHALL group related fields logically
3. WHEN tracking article images THEN the system SHALL store image information in a consistent format
4. WHEN handling SEO data THEN the system SHALL organize SEO fields in a clear, accessible structure