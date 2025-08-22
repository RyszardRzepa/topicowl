ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'QQFJKB7C';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN "priority";--> statement-breakpoint
DROP TYPE "public"."article_priority";