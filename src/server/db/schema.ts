// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration
import { customAlphabet } from "nanoid";
import { sql } from "drizzle-orm";
import { boolean, timestamp, text, integer, varchar, pgEnum, serial } from "drizzle-orm/pg-core";
import { jsonb, pgSchema } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

export const contentMachineSchema = pgSchema("content-machine");

export const generatePublicId = customAlphabet(
  "23456789ABCDEFGHJKMNPQRSTUVWXYZ",
  8,
);

export const users = contentMachineSchema.table("users", {
  id: text("id").primaryKey().default(generatePublicId()),
  clerk_user_id: text("clerk_user_id").unique().notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company_name: text("company_name"),
  domain: text("domain"),
  product_description: text("product_description"),
  keywords: jsonb("keywords"),
  onboarding_completed: boolean("onboarding_completed").default(false).notNull(),

  // Webhook configuration
  webhook_url: text("webhook_url"),
  webhook_secret: text("webhook_secret"),
  webhook_enabled: boolean("webhook_enabled").default(false).notNull(),
  webhook_events: jsonb("webhook_events").default(["article.published"]).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Article status enum for kanban workflow
export const articleStatusEnum = pgEnum("article_status", [
  "idea",
  "to_generate", 
  "generating",
  "wait_for_publish",
  "published",
]);



// Articles table for kanban-based workflow
export const articles = contentMachineSchema.table("articles", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  keywords: jsonb("keywords").default([]).notNull(),
  targetAudience: varchar("target_audience", { length: 255 }),
  status: articleStatusEnum("status").default("idea").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  estimatedReadTime: integer("estimated_read_time"),
  kanbanPosition: integer("kanban_position").default(0).notNull(),
  
  // Content fields (populated after generation)
  metaDescription: varchar("meta_description", { length: 255 }),
  outline: jsonb("outline"),
  draft: text("draft"),
  optimizedContent: text("optimized_content"),
  factCheckReport: jsonb("fact_check_report").default({}).notNull(),
  seoScore: integer("seo_score"),
  internalLinks: jsonb("internal_links").default([]).notNull(),
  sources: jsonb("sources").default([]).notNull(),
  
  // Image fields
  coverImageUrl: text("cover_image_url"),
  coverImageAlt: text("cover_image_alt"),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});

// Article Generation tracking table for separation of concerns
export const articleGeneration = contentMachineSchema.table("article_generation", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => articles.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  
  // Generation process tracking
  taskId: varchar("task_id"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, researching, writing, validating, completed, failed
  progress: integer("progress").default(0).notNull(), // 0-100 percentage
  
  // Phase timestamps
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  
  // Phase results
  researchData: jsonb("research_data").default({}).notNull(),
  draftContent: text("draft_content"),
  validationReport: jsonb("validation_report").default({}).notNull(),
  seoReport: jsonb("seo_report").default({}).notNull(),
  
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
export const articleSettings = contentMachineSchema.table("article_settings", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").references(() => users.id),
  toneOfVoice: text("tone_of_voice"),
  articleStructure: text("article_structure"),
  maxWords: integer("max_words").default(800),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});

// Webhook delivery tracking table
export const webhookDeliveries = contentMachineSchema.table("webhook_deliveries", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").references(() => users.id).notNull(),
  article_id: integer("article_id").references(() => articles.id).notNull(),
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
