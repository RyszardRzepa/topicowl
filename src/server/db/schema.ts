// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration
import { customAlphabet } from "nanoid";
import { sql } from "drizzle-orm";
import {
  boolean,
  timestamp,
  text,
  integer,
  varchar,
  serial,
} from "drizzle-orm/pg-core";
import { jsonb, pgSchema } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

export const contentbotSchema = pgSchema("contentbot");

export const users = contentbotSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  domain: text("domain"),
  productDescription: text("product_description"),
  keywords: jsonb("keywords"),
  onboardingCompleted: boolean("onboarding_completed")
    .default(false)
    .notNull(),

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

// User credits table for tracking article generation credits
export const userCredits = contentbotSchema.table("user_credits", {
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

// Article status enum for kan
export const articleStatusEnum = contentbotSchema.enum("article_status", [
  "idea",
  "scheduled",
  "queued",
  "to_generate",
  "generating",
  "wait_for_publish",
  "published",
  "deleted",
]);

// Articles table for kanban-based workflow
export const articles = contentbotSchema.table("articles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  keywords: jsonb("keywords").default([]).notNull(),
  targetAudience: varchar("target_audience", { length: 255 }),
  status: articleStatusEnum("status").default("idea").notNull(),

  // Publishing scheduling (separate from generation scheduling)
  publishScheduledAt: timestamp("publish_scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  estimatedReadTime: integer("estimated_read_time"),
  kanbanPosition: integer("kanban_position").default(0).notNull(),

  // Content fields (populated after generation)
  slug: varchar("slug", { length: 255 }),
  metaDescription: varchar("meta_description", { length: 255 }),
  metaKeywords: jsonb("meta_keywords").default([]).notNull(),
  draft: text("draft"),
  content: text("content"), // Final published content
  videos: jsonb("videos").default([]).notNull(), // YouTube video embeds
  factCheckReport: jsonb("fact_check_report").default({}).notNull(),
  seoScore: integer("seo_score"),
  internalLinks: jsonb("internal_links").default([]).notNull(),
  sources: jsonb("sources").default([]).notNull(),

  // Image fields
  coverImageUrl: text("cover_image_url"),
  coverImageAlt: text("cover_image_alt"),

  // User-provided notes for AI guidance
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});

// Generation queue table for tracking articles scheduled for generation
export const generationQueue = contentbotSchema.table("generation_queue", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  addedToQueueAt: timestamp("added_to_queue_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  scheduledForDate: timestamp("scheduled_for_date", { withTimezone: true }), // The date this article was scheduled for
  queuePosition: integer("queue_position"), // Order in queue (FIFO)
  schedulingType: varchar("scheduling_type", { length: 20 }).default("manual"), // 'manual', 'automatic'
  status: varchar("status", { length: 20 }).default("queued"), // 'queued', 'processing', 'completed', 'failed'
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Article Generation tracking table for separation of concerns
export const articleGeneration = contentbotSchema.table("article_generation", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),

  // Generation process tracking
  taskId: varchar("task_id"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, researching, writing, quality-control, validating, updating, completed, failed
  progress: integer("progress").default(0).notNull(), // 0-100 percentage

  outline: jsonb("outline"),

  // Phase timestamps
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Phase results
  researchData: jsonb("research_data").default({}).notNull(),
  draftContent: text("draft_content"),
  validationReport: text("validation_report"),
  qualityControlReport: text("quality_control_report"), // Store markdown-formatted quality issues or null
  seoReport: jsonb("seo_report").default({}).notNull(),
  writePrompt: text("write_prompt"), // Store the AI prompt used for writing

  // Related articles
  relatedArticles: jsonb("related_articles")
    .default([])
    .notNull()
    .$type<string[]>(),

  // Image selection tracking
  selectedImageId: text("selected_image_id"),
  imageAttribution: jsonb("image_attribution").$type<{
    photographer: string;
    unsplashUrl: string;
    downloadUrl: string;
  }>(),
  imageQuery: text("image_query"),
  imageKeywords: jsonb("image_keywords").default([]).notNull(),

  // Error handling
  error: text("error"),
  errorDetails: jsonb("error_details"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});

// Article Settings table for global configuration
export const articleSettings = contentbotSchema.table("article_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  toneOfVoice: text("tone_of_voice"),
  articleStructure: text("article_structure"),
  maxWords: integer("max_words").default(800),

  // Competitor domain exclusion
  excludedDomains: jsonb("excluded_domains")
    .default([])
    .notNull()
    .$type<string[]>(),

  // Sitemap functionality
  sitemapUrl: text("sitemap_url"), // User's website sitemap URL (e.g., https://example.com/sitemap.xml)

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});

// Webhook delivery tracking table
export const webhookDeliveries = contentbotSchema.table("webhook_deliveries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
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
});
