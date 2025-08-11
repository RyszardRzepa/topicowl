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
  pgEnum,
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

export const generatePublicId = customAlphabet(
  "23456789ABCDEFGHJKMNPQRSTUVWXYZ",
  8,
);

export const users = contentbotSchema.table("users", {
  id: text("id").primaryKey().default(generatePublicId()),
  clerk_user_id: text("clerk_user_id").unique().notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company_name: text("company_name"),
  domain: text("domain"),
  product_description: text("product_description"),
  keywords: jsonb("keywords"),
  onboarding_completed: boolean("onboarding_completed")
    .default(false)
    .notNull(),

  // Webhook configuration
  webhook_url: text("webhook_url"),
  webhook_secret: text("webhook_secret"),
  webhook_enabled: boolean("webhook_enabled").default(false).notNull(),
  webhook_events: jsonb("webhook_events")
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
  id: text("id").primaryKey().default(generatePublicId()),
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
export const articleStatusEnum = pgEnum("article_status", [
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
  user_id: text("user_id").references(() => users.id),
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

// Add the self-reference after table definition
export const articlesRelations = {
  parent_article_id: integer("parent_article_id"),
};

// Generation queue table for tracking articles scheduled for generation
export const generationQueue = contentbotSchema.table("generation_queue", {
  id: serial("id").primaryKey(),
  article_id: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  user_id: text("user_id")
    .references(() => users.id)
    .notNull(),
  added_to_queue_at: timestamp("added_to_queue_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  scheduled_for_date: timestamp("scheduled_for_date", { withTimezone: true }), // The date this article was scheduled for
  queue_position: integer("queue_position"), // Order in queue (FIFO)
  scheduling_type: varchar("scheduling_type", { length: 20 }).default("manual"), // 'manual', 'automatic'
  status: varchar("status", { length: 20 }).default("queued"), // 'queued', 'processing', 'completed', 'failed'
  attempts: integer("attempts").default(0),
  max_attempts: integer("max_attempts").default(3),
  error_message: text("error_message"),
  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
  processed_at: timestamp("processed_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
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
  user_id: text("user_id").references(() => users.id),
  toneOfVoice: text("tone_of_voice"),
  articleStructure: text("article_structure"),
  maxWords: integer("max_words").default(800),

  // Competitor domain exclusion
  excluded_domains: jsonb("excluded_domains")
    .default([])
    .notNull()
    .$type<string[]>(),

  // Sitemap functionality
  sitemap_url: text("sitemap_url"), // User's website sitemap URL (e.g., https://example.com/sitemap.xml)

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
  user_id: text("user_id")
    .references(() => users.id)
    .notNull(),
  article_id: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  webhook_url: text("webhook_url").notNull(),
  event_type: text("event_type").default("article.published").notNull(),

  // Delivery tracking
  status: text("status").default("pending").notNull(), // pending, success, failed, retrying
  attempts: integer("attempts").default(1).notNull(),
  max_attempts: integer("max_attempts").default(3).notNull(),

  // Request/Response data
  request_payload: jsonb("request_payload").notNull(),
  response_status: integer("response_status"),
  response_body: text("response_body"),
  delivery_time_ms: integer("delivery_time_ms"),

  // Error handling
  error_message: text("error_message"),
  error_details: jsonb("error_details"),

  // Retry scheduling
  next_retry_at: timestamp("next_retry_at", { withTimezone: true }),
  retry_backoff_seconds: integer("retry_backoff_seconds").default(30).notNull(),

  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  delivered_at: timestamp("delivered_at", { withTimezone: true }),
  failed_at: timestamp("failed_at", { withTimezone: true }),
});
