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

export const articlePriorityEnum = pgEnum("article_priority", [
  "low",
  "medium", 
  "high",
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
  priority: articlePriorityEnum("priority").default("medium").notNull(),
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
  
  // Generation tracking
  generationTaskId: varchar("generation_task_id"),
  generationScheduledAt: timestamp("generation_scheduled_at", { withTimezone: true }),
  generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
  generationCompletedAt: timestamp("generation_completed_at", { withTimezone: true }),
  generationError: text("generation_error"),
  
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
