ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'HBVZX2DK';--> statement-breakpoint
-- Rename image fields to preserve data
ALTER TABLE "content-machine"."articles" RENAME COLUMN "featured_image_url" TO "cover_image_url";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" RENAME COLUMN "featured_image_alt" TO "cover_image_alt";--> statement-breakpoint
-- Drop redundant generation tracking fields
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_task_id";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_progress";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_scheduled_at";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_started_at";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_completed_at";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "generation_error";--> statement-breakpoint
-- Drop analytics tracking fields
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "views";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "clicks";--> statement-breakpoint
-- Drop image attribution fields that were moved to articleGeneration table
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "image_attribution";--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN IF EXISTS "unsplash_image_id";