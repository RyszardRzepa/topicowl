ALTER TABLE "topicowl"."article_generations" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generations" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generations" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DEFAULT 'idea';--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
DROP TYPE "topicowl"."article_generation_status";--> statement-breakpoint
DROP TYPE "topicowl"."article_status";
