ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT 'ZKV5S22M';--> statement-breakpoint
ALTER TABLE "contentbot"."article_generation" ADD COLUMN "write_prompt" text;