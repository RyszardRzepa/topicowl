-- Drop defaults first to remove dependency on the enum type
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

-- Temporarily cast to text so the enum can be recreated
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "topicowl"."article_status";--> statement-breakpoint
CREATE TYPE "topicowl"."article_status" AS ENUM('idea', 'scheduled', 'generating', 'wait_for_publish', 'published', 'failed', 'deleted');--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DATA TYPE "topicowl"."article_status" USING "status"::"topicowl"."article_status";--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DATA TYPE "topicowl"."article_status" USING "status"::"topicowl"."article_status";--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ALTER COLUMN "status" SET DATA TYPE "topicowl"."article_status" USING "status"::"topicowl"."article_status";

-- Restore defaults aligned to the new enum
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DEFAULT 'idea';--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled';
