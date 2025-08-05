ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT 'VW86FT9T';--> statement-breakpoint
ALTER TABLE "contentbot"."article_generation" ADD COLUMN "outline" jsonb;--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "outline";