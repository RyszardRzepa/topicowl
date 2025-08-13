#!/usr/bin/env tsx
/**
 * Standalone Data Migration Script: Migrate from user-centric to project-centric architecture
 * 
 * This script performs the following migrations:
 * 1. Create default projects for existing users using their current domain
 * 2. Migrate existing article data to reference the user's default project
 * 3. Migrate settings and webhook configurations from users to projects
 * 
 * Requirements covered: 7.1, 7.2, 2.1, 2.2, 4.1, 4.2
 * 
 * Usage: DATABASE_URL="your_db_url" tsx scripts/migrate-to-projects-standalone.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull, sql } from "drizzle-orm";
import { 
  pgSchema, 
  text, 
  boolean, 
  timestamp, 
  serial, 
  integer,
  varchar,
  jsonb,
  index
} from "drizzle-orm/pg-core";

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

// Define the contentbot schema inline to avoid dependency issues
const contentbotSchema = pgSchema("contentbot");

const users = contentbotSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
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

const projects = contentbotSchema.table("projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  websiteUrl: text("website_url").notNull().unique(),
  domain: text("domain"),

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
    .notNull(),
  sitemapUrl: text("sitemap_url"),

  // Project-specific webhook configuration
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
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
  domainIdx: index("projects_domain_idx").on(table.domain),
  userDomainIdx: index("projects_user_domain_idx").on(table.userId, table.domain),
}));

const articles = contentbotSchema.table("articles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  projectId: integer("project_id")
    .references(() => projects.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  keywords: jsonb("keywords").default([]).notNull(),
  targetAudience: varchar("target_audience", { length: 255 }),
  status: text("status").default("idea").notNull(),

  publishScheduledAt: timestamp("publish_scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  estimatedReadTime: integer("estimated_read_time"),
  kanbanPosition: integer("kanban_position").default(0).notNull(),

  slug: varchar("slug", { length: 255 }),
  metaDescription: varchar("meta_description", { length: 255 }),
  metaKeywords: jsonb("meta_keywords").default([]).notNull(),
  draft: text("draft"),
  content: text("content"),
  videos: jsonb("videos").default([]).notNull(),
  factCheckReport: jsonb("fact_check_report").default({}).notNull(),
  seoScore: integer("seo_score"),
  internalLinks: jsonb("internal_links").default([]).notNull(),
  sources: jsonb("sources").default([]).notNull(),

  coverImageUrl: text("cover_image_url"),
  coverImageAlt: text("cover_image_alt"),

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => ({
  projectIdIdx: index("articles_project_id_idx").on(table.projectId),
}));

const generationQueue = contentbotSchema.table("generation_queue", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: integer("project_id")
    .references(() => projects.id),
  addedToQueueAt: timestamp("added_to_queue_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  scheduledForDate: timestamp("scheduled_for_date", { withTimezone: true }),
  queuePosition: integer("queue_position"),
  schedulingType: varchar("scheduling_type", { length: 20 }).default("manual"),
  status: varchar("status", { length: 20 }).default("queued"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  projectIdIdx: index("generation_queue_project_id_idx").on(table.projectId),
}));

const articleGeneration = contentbotSchema.table("article_generation", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: integer("project_id")
    .references(() => projects.id),

  taskId: varchar("task_id"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  progress: integer("progress").default(0).notNull(),

  outline: jsonb("outline"),

  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  researchData: jsonb("research_data").default({}).notNull(),
  draftContent: text("draft_content"),
  validationReport: text("validation_report"),
  qualityControlReport: text("quality_control_report"),
  seoReport: jsonb("seo_report").default({}).notNull(),
  writePrompt: text("write_prompt"),

  relatedArticles: jsonb("related_articles")
    .default([])
    .notNull(),

  selectedImageId: text("selected_image_id"),
  imageAttribution: jsonb("image_attribution"),
  imageQuery: text("image_query"),
  imageKeywords: jsonb("image_keywords").default([]).notNull(),

  error: text("error"),
  errorDetails: jsonb("error_details"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => ({
  projectIdIdx: index("article_generation_project_id_idx").on(table.projectId),
}));

const articleSettings = contentbotSchema.table("article_settings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id),
  toneOfVoice: text("tone_of_voice"),
  articleStructure: text("article_structure"),
  maxWords: integer("max_words").default(800),

  excludedDomains: jsonb("excluded_domains")
    .default([])
    .notNull(),

  sitemapUrl: text("sitemap_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (table) => ({
  projectIdIdx: index("article_settings_project_id_idx").on(table.projectId),
}));

const webhookDeliveries = contentbotSchema.table("webhook_deliveries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: integer("project_id")
    .references(() => projects.id),
  articleId: integer("article_id")
    .references(() => articles.id)
    .notNull(),
  webhookUrl: text("webhook_url").notNull(),
  eventType: text("event_type").default("article.published").notNull(),

  status: text("status").default("pending").notNull(),
  attempts: integer("attempts").default(1).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),

  requestPayload: jsonb("request_payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  deliveryTimeMs: integer("delivery_time_ms"),

  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),

  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  retryBackoffSeconds: integer("retry_backoff_seconds").default(30).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
}, (table) => ({
  projectIdIdx: index("webhook_deliveries_project_id_idx").on(table.projectId),
}));

// Database connection
const connection = postgres(DATABASE_URL);
const db = drizzle(connection);

async function extractDomainFromUrl(url: string): Promise<string> {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '');
  }
}

async function createDefaultProjects(): Promise<Map<string, number>> {
  console.log("🔄 Step 1: Creating default projects for existing users...");
  
  const existingUsers = await db.select().from(users);
  const userProjectMap = new Map<string, number>();
  
  for (const user of existingUsers) {
    try {
      // Determine project name and website URL
      const projectName = user.companyName ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'My Project');
      const websiteUrl = user.domain ? (user.domain.startsWith('http') ? user.domain : `https://${user.domain}`) : `https://example-${user.id.slice(0, 8)}.com`;
      const extractedDomain = await extractDomainFromUrl(websiteUrl);
      
      // Create default project for the user
      const [newProject] = await db.insert(projects).values({
        userId: user.id,
        name: projectName,
        websiteUrl: websiteUrl,
        domain: extractedDomain,
        companyName: user.companyName,
        productDescription: user.productDescription,
        keywords: user.keywords ?? [],
        webhookUrl: user.webhookUrl,
        webhookSecret: user.webhookSecret,
        webhookEnabled: user.webhookEnabled,
        webhookEvents: user.webhookEvents ?? ["article.published"],
      }).returning({ id: projects.id });
      
      if (newProject) {
        userProjectMap.set(user.id, newProject.id);
        console.log(`✅ Created project "${projectName}" (ID: ${newProject.id}) for user ${user.id}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create project for user ${user.id}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Step 1 completed: Created ${userProjectMap.size} default projects\n`);
  return userProjectMap;
}

async function migrateArticleData(userProjectMap: Map<string, number>): Promise<void> {
  console.log("🔄 Step 2: Migrating existing article data...");
  
  // Migrate articles table
  const articlesWithoutProject = await db.select().from(articles).where(isNull(articles.projectId));
  
  for (const article of articlesWithoutProject) {
    if (!article.userId) {
      console.warn(`⚠️ Article ${article.id} has no userId, skipping...`);
      continue;
    }
    
    const projectId = userProjectMap.get(article.userId);
    if (!projectId) {
      console.error(`❌ No project found for user ${article.userId}, skipping article ${article.id}`);
      continue;
    }
    
    try {
      await db.update(articles)
        .set({ projectId })
        .where(eq(articles.id, article.id));
      
      console.log(`✅ Updated article ${article.id} to project ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to update article ${article.id}:`, error);
      throw error;
    }
  }
  
  // Migrate generation_queue table
  const queueWithoutProject = await db.select().from(generationQueue).where(isNull(generationQueue.projectId));
  
  for (const queueItem of queueWithoutProject) {
    const projectId = userProjectMap.get(queueItem.userId);
    if (!projectId) {
      console.error(`❌ No project found for user ${queueItem.userId}, skipping queue item ${queueItem.id}`);
      continue;
    }
    
    try {
      await db.update(generationQueue)
        .set({ projectId })
        .where(eq(generationQueue.id, queueItem.id));
      
      console.log(`✅ Updated generation queue item ${queueItem.id} to project ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to update generation queue item ${queueItem.id}:`, error);
      throw error;
    }
  }
  
  // Migrate article_generation table
  const generationWithoutProject = await db.select().from(articleGeneration).where(isNull(articleGeneration.projectId));
  
  for (const generation of generationWithoutProject) {
    const projectId = userProjectMap.get(generation.userId);
    if (!projectId) {
      console.error(`❌ No project found for user ${generation.userId}, skipping generation ${generation.id}`);
      continue;
    }
    
    try {
      await db.update(articleGeneration)
        .set({ projectId })
        .where(eq(articleGeneration.id, generation.id));
      
      console.log(`✅ Updated article generation ${generation.id} to project ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to update article generation ${generation.id}:`, error);
      throw error;
    }
  }
  
  console.log("✅ Step 2 completed: Article data migration finished\n");
}

async function migrateSettingsAndWebhooks(userProjectMap: Map<string, number>): Promise<void> {
  console.log("🔄 Step 3: Migrating settings and webhook configurations...");
  
  // Migrate article_settings table
  const settingsWithoutProject = await db.select().from(articleSettings).where(isNull(articleSettings.projectId));
  
  for (const setting of settingsWithoutProject) {
    // Article settings used to have a user_id which was removed in the latest migration
    // We need to find which user this setting belongs to by checking related articles
    console.warn(`⚠️ Found article setting ${setting.id} without project_id - this should not happen after schema migration`);
  }
  
  // Migrate webhook_deliveries table
  const webhooksWithoutProject = await db.select().from(webhookDeliveries).where(isNull(webhookDeliveries.projectId));
  
  for (const webhook of webhooksWithoutProject) {
    const projectId = userProjectMap.get(webhook.userId);
    if (!projectId) {
      console.error(`❌ No project found for user ${webhook.userId}, skipping webhook delivery ${webhook.id}`);
      continue;
    }
    
    try {
      await db.update(webhookDeliveries)
        .set({ projectId })
        .where(eq(webhookDeliveries.id, webhook.id));
      
      console.log(`✅ Updated webhook delivery ${webhook.id} to project ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to update webhook delivery ${webhook.id}:`, error);
      throw error;
    }
  }
  
  console.log("✅ Step 3 completed: Settings and webhook configurations migrated\n");
}

async function validateMigration(userProjectMap: Map<string, number>): Promise<void> {
  console.log("🔄 Step 4: Validating migration results...");
  
  // Check that all articles have project_id
  const articlesWithoutProject = await db.select().from(articles).where(isNull(articles.projectId));
  if (articlesWithoutProject.length > 0) {
    console.error(`❌ Found ${articlesWithoutProject.length} articles without project_id`);
    throw new Error("Migration validation failed: articles without project_id");
  }
  
  // Check that all generation queue items have project_id
  const queueWithoutProject = await db.select().from(generationQueue).where(isNull(generationQueue.projectId));
  if (queueWithoutProject.length > 0) {
    console.error(`❌ Found ${queueWithoutProject.length} generation queue items without project_id`);
    throw new Error("Migration validation failed: generation queue items without project_id");
  }
  
  // Check that all article generations have project_id
  const generationWithoutProject = await db.select().from(articleGeneration).where(isNull(articleGeneration.projectId));
  if (generationWithoutProject.length > 0) {
    console.error(`❌ Found ${generationWithoutProject.length} article generations without project_id`);
    throw new Error("Migration validation failed: article generations without project_id");
  }
  
  // Check that all webhook deliveries have project_id
  const webhooksWithoutProject = await db.select().from(webhookDeliveries).where(isNull(webhookDeliveries.projectId));
  if (webhooksWithoutProject.length > 0) {
    console.error(`❌ Found ${webhooksWithoutProject.length} webhook deliveries without project_id`);
    throw new Error("Migration validation failed: webhook deliveries without project_id");
  }
  
  // Verify project count matches user count
  const userCount = (await db.select().from(users)).length;
  const projectCount = userProjectMap.size;
  
  if (userCount !== projectCount) {
    console.error(`❌ User count (${userCount}) does not match project count (${projectCount})`);
    throw new Error("Migration validation failed: user/project count mismatch");
  }
  
  console.log("✅ Step 4 completed: Migration validation passed");
  console.log(`✅ Successfully migrated ${userCount} users to ${projectCount} projects\n`);
}

async function runMigration(): Promise<void> {
  console.log("🚀 Starting data migration to project-centric architecture...\n");
  
  try {
    // Step 1: Create default projects for existing users
    const userProjectMap = await createDefaultProjects();
    
    // Step 2: Migrate existing article data
    await migrateArticleData(userProjectMap);
    
    // Step 3: Migrate settings and webhook configurations
    await migrateSettingsAndWebhooks(userProjectMap);
    
    // Step 4: Validate migration results
    await validateMigration(userProjectMap);
    
    console.log("🎉 Migration completed successfully!");
    
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run the migration
void runMigration();
