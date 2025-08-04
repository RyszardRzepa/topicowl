# Design Document

## Overview

This design addresses the database schema optimization for the Contentbot article management system. The current schema has three main issues:

1. **Redundant Fields**: The `articles`, `articleGeneration`, and `generationQueue` tables contain overlapping fields for scheduling, status tracking, and metadata
2. **Complex Queries**: The WorkflowDashboard requires complex joins across multiple tables to display article information
3. **Data Inconsistency**: Having generation status in multiple places leads to potential inconsistencies

The optimized design consolidates functionality into a streamlined schema that better supports the kanban workflow while maintaining all necessary features.

## Architecture

### Current Schema Problems

**Redundant Scheduling Fields:**
- `articles.scheduledAt` vs `generationQueue.scheduled_for_date`
- `articles.scheduling_type` vs `generationQueue.scheduling_type`
- Multiple timestamp fields serving similar purposes

**Duplicated Status Tracking:**
- `articles.status` (kanban status)
- `articleGeneration.status` (generation phase)
- `generationQueue.status` (queue status)

**Complex Generation Tracking:**
- Generation progress split between `articles` and `articleGeneration`
- Error handling across multiple tables
- Inconsistent field naming conventions

### Proposed Architecture

The optimized schema uses a **consolidated approach** with two main tables:

1. **Enhanced Articles Table**: Primary table containing all article data, generation tracking, and scheduling
2. **Article Settings Table**: Remains unchanged for user preferences
3. **Webhook Deliveries Table**: Remains unchanged for delivery tracking

## Components and Interfaces

### Enhanced Articles Table

```sql
-- Optimized articles table with integrated generation tracking
export const articles = contentbotSchema.table("articles", {
  // Core article fields
  id: serial("id").primaryKey(),
  user_id: text("user_id").references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  keywords: jsonb("keywords").default([]).notNull(),
  target_audience: varchar("target_audience", { length: 255 }),
  
  // Workflow status (single source of truth)
  status: articleStatusEnum("status").default("idea").notNull(),
  kanban_position: integer("kanban_position").default(0).notNull(),
  
  // Unified scheduling (replaces generationQueue)
  scheduled_for: timestamp("scheduled_for", { withTimezone: true }),
  scheduling_type: varchar("scheduling_type", { length: 20 }).default("manual"),
  scheduling_frequency: varchar("scheduling_frequency", { length: 20 }),
  scheduling_config: jsonb("scheduling_config"),
  next_schedule_at: timestamp("next_schedule_at", { withTimezone: true }),
  schedule_count: integer("schedule_count").default(0),
  
  // Generation tracking (consolidated from articleGeneration)
  generation_status: varchar("generation_status", { length: 50 }),
  generation_progress: integer("generation_progress").default(0),
  generation_phase: varchar("generation_phase", { length: 50 }),
  generation_started_at: timestamp("generation_started_at", { withTimezone: true }),
  generation_completed_at: timestamp("generation_completed_at", { withTimezone: true }),
  generation_error: text("generation_error"),
  generation_attempts: integer("generation_attempts").default(0),
  
  // Content fields (organized by state)
  outline: jsonb("outline"),
  draft_content: text("draft_content"),
  published_content: text("published_content"),
  
  // SEO and metadata (grouped logically)
  slug: varchar("slug", { length: 255 }),
  meta_description: varchar("meta_description", { length: 255 }),
  meta_keywords: jsonb("meta_keywords").default([]).notNull(),
  seo_score: integer("seo_score"),
  estimated_read_time: integer("estimated_read_time"),
  
  // Media and external content
  cover_image_url: text("cover_image_url"),
  cover_image_alt: text("cover_image_alt"),
  videos: jsonb("videos").default([]).notNull(),
  
  // Research and validation data
  research_data: jsonb("research_data").default({}).notNull(),
  sources: jsonb("sources").default([]).notNull(),
  internal_links: jsonb("internal_links").default([]).notNull(),
  fact_check_report: jsonb("fact_check_report").default({}).notNull(),
  
  // Publishing
  published_at: timestamp("published_at", { withTimezone: true }),
  
  // Audit fields
  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});
```

### Status and Phase Enums

```sql
-- Enhanced status enum for clearer workflow
export const articleStatusEnum = pgEnum("article_status", [
  "idea",           // Initial idea state
  "scheduled",      // Scheduled for generation
  "generating",     // Currently being generated
  "ready",          // Generation complete, ready for review/publish
  "published",      // Published and live
  "archived",       // Archived/deleted
]);

-- Generation phase tracking
export const generationPhaseEnum = pgEnum("generation_phase", [
  "research",       // Researching topic
  "outline",        // Creating outline
  "writing",        // Writing content
  "validation",     // Fact-checking
  "optimization",   // Final optimizations
]);
```

## Data Models

### Article Model (TypeScript Interface)

```typescript
interface Article {
  // Core fields
  id: number;
  userId: string;
  title: string;
  description?: string;
  keywords: string[];
  targetAudience?: string;
  
  // Workflow
  status: ArticleStatus;
  kanbanPosition: number;
  
  // Scheduling
  scheduledFor?: Date;
  schedulingType: 'manual' | 'automatic';
  schedulingFrequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  schedulingConfig?: Record<string, any>;
  nextScheduleAt?: Date;
  scheduleCount: number;
  
  // Generation tracking
  generationStatus?: 'pending' | 'researching' | 'writing' | 'validating' | 'completed' | 'failed';
  generationProgress: number;
  generationPhase?: 'research' | 'outline' | 'writing' | 'validation' | 'optimization';
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  generationError?: string;
  generationAttempts: number;
  
  // Content
  outline?: any;
  draftContent?: string;
  publishedContent?: string;
  
  // SEO
  slug?: string;
  metaDescription?: string;
  metaKeywords: string[];
  seoScore?: number;
  estimatedReadTime?: number;
  
  // Media
  coverImageUrl?: string;
  coverImageAlt?: string;
  videos: VideoEmbed[];
  
  // Research
  researchData: Record<string, any>;
  sources: any[];
  internalLinks: any[];
  factCheckReport: Record<string, any>;
  
  // Publishing
  publishedAt?: Date;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}
```

### Migration Strategy

The migration will be performed in phases to ensure data integrity:

**Phase 1: Add New Fields**
- Add consolidated fields to articles table
- Keep existing tables temporarily

**Phase 2: Data Migration**
- Migrate data from articleGeneration to articles
- Migrate data from generationQueue to articles
- Validate data consistency

**Phase 3: Update Application Code**
- Update API routes to use new schema
- Update WorkflowDashboard queries
- Update generation tracking logic

**Phase 4: Cleanup**
- Drop articleGeneration table
- Drop generationQueue table
- Remove unused fields from articles table

## Error Handling

### Generation Error Recovery

```typescript
// Simplified error handling with consolidated tracking
async function handleGenerationError(articleId: number, error: string) {
  await db.update(articles)
    .set({
      status: 'idea', // Reset to allow retry
      generation_status: 'failed',
      generation_error: error,
      generation_attempts: sql`generation_attempts + 1`,
      updated_at: new Date()
    })
    .where(eq(articles.id, articleId));
}
```

### Status Consistency

```typescript
// Single source of truth for article status
async function updateArticleStatus(articleId: number, status: ArticleStatus) {
  const updates: Partial<Article> = { status, updated_at: new Date() };
  
  // Auto-clear generation fields when moving out of generating status
  if (status !== 'generating') {
    updates.generation_status = null;
    updates.generation_progress = 0;
    updates.generation_phase = null;
  }
  
  await db.update(articles).set(updates).where(eq(articles.id, articleId));
}
```

## Testing Strategy

### Data Migration Testing

1. **Pre-migration Validation**
   - Count records in each table
   - Validate data relationships
   - Export sample data for comparison

2. **Migration Testing**
   - Test migration scripts on copy of production data
   - Validate all data is correctly transferred
   - Test rollback procedures

3. **Post-migration Validation**
   - Verify WorkflowDashboard displays correctly
   - Test all article operations (create, update, generate, publish)
   - Performance testing on simplified queries

### API Testing

1. **Workflow Dashboard Queries**
   - Test article listing by status
   - Verify generation progress display
   - Test status transitions

2. **Generation Process**
   - Test generation tracking updates
   - Verify error handling
   - Test retry mechanisms

3. **Scheduling Operations**
   - Test article scheduling
   - Verify queue processing
   - Test recurring schedules

## Performance Improvements

### Query Optimization

**Before (Complex Join):**
```sql
SELECT a.*, ag.status as generation_status, ag.progress, gq.queue_position
FROM articles a
LEFT JOIN article_generation ag ON a.id = ag.article_id
LEFT JOIN generation_queue gq ON a.id = gq.article_id
WHERE a.user_id = ? AND a.status != 'deleted'
```

**After (Simple Query):**
```sql
SELECT * FROM articles 
WHERE user_id = ? AND status != 'archived'
ORDER BY kanban_position, created_at
```

### Index Strategy

```sql
-- Optimized indexes for common queries
CREATE INDEX idx_articles_user_status ON articles(user_id, status);
CREATE INDEX idx_articles_scheduled ON articles(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_articles_generation ON articles(generation_status) WHERE generation_status IS NOT NULL;
```

This design eliminates the complexity of managing multiple tables while maintaining all functionality needed for the WorkflowDashboard and article generation system.