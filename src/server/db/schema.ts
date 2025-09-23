// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration
import { sql } from "drizzle-orm";
import {
  boolean,
  timestamp,
  text,
  integer,
  varchar,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { jsonb, pgSchema } from "drizzle-orm/pg-core";
import type { ArticleGenerationArtifacts } from "@/types";
import type { GenerationTaskStatus } from "@/lib/services/topic-discovery/types";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

export const topicowlSchema = pgSchema("topicowl");

// Article-level kanban statuses
export const articleStatusEnum = topicowlSchema.enum("article_status", [
  "idea",
  "scheduled",
  "generating",
  "wait_for_publish",
  "published",
  "failed",
]);

// Per-run generation statuses (phases + terminal states)
export const articleGenerationStatusEnum = topicowlSchema.enum(
  "article_generation_status",
  [
    "scheduled",
    "research",
    "image",
    "writing",
    "quality-control",
    "validating",
    "updating",
    "completed",
    "failed",
  ],
);

// TypeScript types for use in API routes and services  
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];
export type ArticleGenerationStatus =
  (typeof articleGenerationStatusEnum.enumValues)[number];

export const users = topicowlSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  domain: text("domain"),
  productDescription: text("product_description"),
  keywords: jsonb("keywords"),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),

  // Webhook configuration
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
  webhookEvents: jsonb("webhook_events")
    .default(["article.published"])
    .notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Projects table for multi-project support
export const projects = topicowlSchema.table(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    websiteUrl: text("website_url").notNull(),
    domain: text("domain"), // Extracted from website_url for easy filtering

    // Project-specific settings
    companyName: text("company_name"),
    productDescription: text("product_description"),
    keywords: jsonb("keywords").default([]).notNull(),

    // Project-specific article settings
    toneOfVoice: text("tone_of_voice"),
    articleStructure: text("article_structure"),
    maxWords: integer("max_words").default(800),
    excludedDomains: jsonb("excluded_domains")
      .default([])
      .notNull()
      .$type<string[]>(),
    sitemapUrl: text("sitemap_url"),

    // Project-specific webhook configuration
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    webhookEvents: jsonb("webhook_events")
      .default(["article.published"])
      .notNull(),

    // Content generation preferences
    includeVideo: boolean("include_video").default(true).notNull(),
    includeTables: boolean("include_tables").default(true).notNull(),
    includeCitations: boolean("include_citations").default(true).notNull(),
    citationRegion: text("citation_region").default("worldwide"),
    brandColor: text("brand_color"),
    exampleArticleUrl: text("example_article_url"),
    targetAudience: text("target_audience"),
    // Primary content language for generation (BCP-47/ISO-639-1 code like "en", "es")
    language: text("language").default("en"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Index on user_id for efficient querying of user's projects
    userIdIdx: index("projects_user_id_idx").on(table.userId),
    // Index on domain for efficient domain-based lookups
    domainIdx: index("projects_domain_idx").on(table.domain),
    // Composite index for user + domain queries
    userDomainIdx: index("projects_user_domain_idx").on(
      table.userId,
      table.domain,
    ),
  }),
);

// User credits table for tracking article generation credits
export const userCredits = topicowlSchema.table("user_credits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  amount: integer("amount").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Note: Unified articleStatusEnum is defined above

// Articles table for kanban-based workflow
export const articles = topicowlSchema.table(
  "articles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    keywords: jsonb("keywords").default([]).notNull(),
    targetAudience: varchar("target_audience", { length: 255 }),
    status: articleStatusEnum("status").default("idea").notNull(),

    // Publishing scheduling (separate from generation scheduling)
    publishScheduledAt: timestamp("publish_scheduled_at", {
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    estimatedReadTime: integer("estimated_read_time"),
    kanbanPosition: integer("kanban_position").default(0).notNull(),

    // Content fields (populated after generation)
    slug: varchar("slug", { length: 255 }),
    metaDescription: varchar("meta_description", { length: 255 }),
    introParagraph: text("intro_paragraph"),
    metaKeywords: jsonb("meta_keywords").default([]).notNull(),
    content: text("content"), // Current working article content
    videos: jsonb("videos").default([]).notNull(), // YouTube video embeds

    // Image fields
    coverImageUrl: text("cover_image_url"),
    coverImageAlt: text("cover_image_alt"),

    // User-provided notes for AI guidance
    notes: text("notes"),
    structureOverride: jsonb("structure_override"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Index on project_id for efficient querying of project's articles
    projectIdIdx: index("articles_project_id_idx").on(table.projectId),
  }),
);

// Generation queue table removed - scheduling fields moved to articles table directly

// Article Generation tracking table for separation of concerns
export const articleGenerations = topicowlSchema.table(
  "article_generations",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .references(() => articles.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),

    taskId: varchar("task_id"),
    status: articleGenerationStatusEnum("status").default("scheduled").notNull(),
    progress: integer("progress").default(0).notNull(),
    artifacts: jsonb("artifacts")
      .$type<ArticleGenerationArtifacts>()
      .default({})
      .notNull(),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    error: text("error"),
    errorDetails: jsonb("error_details"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index("article_generations_project_id_idx").on(
      table.projectId,
    ),
  }),
);

// Article Settings table removed - settings are now stored directly in projects table
// This eliminates duplication and provides a single source of truth for project settings

// Reddit posts table for scheduling Reddit posts
export const redditPosts = topicowlSchema.table(
  "reddit_posts",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    subreddit: varchar("subreddit", { length: 255 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    text: text("text").notNull(),

    // Reusing the existing enum for consistency with article scheduling
    status: articleStatusEnum("status").default("scheduled").notNull(),

    // Scheduling fields
    publishScheduledAt: timestamp("publish_scheduled_at", {
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // Error handling for failed posts
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Index on project_id for efficient querying of project's Reddit posts
    projectIdIdx: index("reddit_posts_project_id_idx").on(table.projectId),
  }),
);

export const topicGenerationTasks = topicowlSchema.table(
  "topic_generation_tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    taskId: text("task_id").notNull().unique(),
    status: text("status").$type<GenerationTaskStatus>().default("running").notNull(),
    topicsGenerated: integer("topics_generated").default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  }
);

// Reddit automation workflows table
export const redditAutomations = topicowlSchema.table(
  "reddit_automations",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    workflow: jsonb("workflow").notNull(), // Stores complete workflow configuration
    isActive: boolean("is_active").default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (_table) => ({}),
);

// Reddit automation execution runs table
export const redditAutomationRuns = topicowlSchema.table(
  "reddit_automation_runs",
  {
    id: serial("id").primaryKey(),
    automationId: integer("automation_id")
      .references(() => redditAutomations.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").notNull(), // 'running', 'completed', 'failed'
    results: jsonb("results"), // Execution results and metrics
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (_table) => ({}),
);

export const redditProcessedPosts = topicowlSchema.table(
  "reddit_processed_posts",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    postId: text("post_id").notNull(), // Reddit post ID (e.g., "t3_abc123")
    subreddit: text("subreddit").notNull(),
    postTitle: text("post_title").notNull(),
    postUrl: text("post_url").notNull(),

    // Evaluation results
    evaluationScore: integer("evaluation_score"), // Score * 10 for integer storage
    wasApproved: boolean("was_approved").default(false).notNull(),
    evaluationReasoning: text("evaluation_reasoning"),

    // Generated reply
    replyContent: text("reply_content"),
    replyPosted: boolean("reply_posted").default(false).notNull(),
    replyPostedAt: timestamp("reply_posted_at", { withTimezone: true }),

    // Tracking
    automationId: integer("automation_id").references(
      () => redditAutomations.id,
      { onDelete: "set null" },
    ),
    runId: integer("run_id").references(() => redditAutomationRuns.id, {
      onDelete: "set null",
    }),

    processedAt: timestamp("processed_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    projectPostUnique: uniqueIndex(
      "reddit_processed_posts_project_post_idx",
    ).on(table.projectId, table.postId),
  }),
);

// Webhook delivery tracking table
export const webhookDeliveries = topicowlSchema.table(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    articleId: integer("article_id")
      .references(() => articles.id)
      .notNull(),
    webhookUrl: text("webhook_url").notNull(),
    eventType: text("event_type").default("article.published").notNull(),

    // Delivery tracking
    status: text("status").default("pending").notNull(), // pending, success, failed, retrying
    attempts: integer("attempts").default(1).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),

    // Request/Response data
    requestPayload: jsonb("request_payload").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    deliveryTimeMs: integer("delivery_time_ms"),

    // Error handling
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details"),

    // Retry scheduling
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    retryBackoffSeconds: integer("retry_backoff_seconds").default(30).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (table) => ({
    // Index on project_id for efficient querying of project's webhook deliveries
    projectIdIdx: index("webhook_deliveries_project_id_idx").on(
      table.projectId,
    ),
  }),
);

// API Keys table for external access (one key per project)
export const apiKeys = topicowlSchema.table(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    keyHash: text("key_hash").notNull().unique(), // Store SHA-256 hash of the API key
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }), // Track usage for audit
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index("api_keys_project_id_idx").on(table.projectId),
  }),
);

// Reddit tasks - the core of everything for weekly Reddit engagement
export const redditTasks = topicowlSchema.table(
  "reddit_tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),

    // Scheduling
    scheduledDate: timestamp("scheduled_date", {
      withTimezone: true,
    }).notNull(),
    taskOrder: integer("task_order").default(1), // ordering within a day

    // Task details
    taskType: varchar("task_type", { length: 20 }).notNull(), // 'comment' or 'post'
    subreddit: varchar("subreddit", { length: 255 }).notNull(),
    searchKeywords: text("search_keywords"), // for finding relevant threads
    prompt: text("prompt").notNull(), // what to write about
    aiDraft: text("ai_draft"), // optional AI-generated content

    // Completion tracking
    status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'completed', 'skipped'
    redditUrl: text("reddit_url"), // link to actual submission
    completedAt: timestamp("completed_at", { withTimezone: true }),
    karmaEarned: integer("karma_earned").default(0),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectDateIdx: index("reddit_tasks_project_date_idx").on(
      table.projectId,
      table.scheduledDate,
    ),
    statusIdx: index("reddit_tasks_status_idx").on(table.status),
  }),
);

// User preferences for generating Reddit tasks
export const redditSettings = topicowlSchema.table(
  "reddit_settings",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),

    // Generation preferences
    tasksPerDay: integer("tasks_per_day").default(1),
    commentRatio: integer("comment_ratio").default(80), // 80% comments, 20% posts (stored as integer percentage)

    // Targeting
    targetSubreddits: jsonb("target_subreddits").default([]).notNull(), // ["r/SaaS", "r/startups"]
    expertiseTopics: jsonb("expertise_topics").default([]).notNull(), // for better prompt generation

    // Settings
    autoGenerateWeekly: boolean("auto_generate_weekly").default(true),
    lastGeneratedDate: timestamp("last_generated_date", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectUniqueIdx: uniqueIndex("reddit_settings_project_unique_idx").on(
      table.projectId,
    ),
  }),
);
