ALTER TABLE "topicowl"."article_generation" ALTER COLUMN "validation_report" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ALTER COLUMN "validation_report" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ADD COLUMN "intro_paragraph" text;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ADD COLUMN "intro_paragraph" text;--> statement-breakpoint