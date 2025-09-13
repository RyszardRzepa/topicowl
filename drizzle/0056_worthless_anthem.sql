ALTER TABLE "topicowl"."article_generation" ADD COLUMN "artifacts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ADD COLUMN "checklist" jsonb;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ADD COLUMN "structure_override" jsonb;--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD COLUMN "structure_template" jsonb;