-- Add new columns for AI agent article generation system
-- Using IF NOT EXISTS to safely add columns that might already exist

ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "current_phase" text;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "last_updated" timestamp with time zone;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "meta_variants" jsonb;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "external_links_used" text[];
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "headings_outline" jsonb;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "validation_report_2" jsonb;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "link_issues" jsonb;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "schema_json" text;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "cover_image_url_2" text;
ALTER TABLE "topicowl"."article_generation" ADD COLUMN IF NOT EXISTS "cover_image_alt_2" text;

-- Update reddit_settings default value
ALTER TABLE "topicowl"."reddit_settings" ALTER COLUMN "tasks_per_day" SET DEFAULT 1;