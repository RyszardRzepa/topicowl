-- Make drop constraint idempotent in case migration partially ran previously
DO $$ BEGIN
	ALTER TABLE "contentbot"."article_settings" DROP CONSTRAINT "article_settings_user_id_users_id_fk";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
--> statement-breakpoint
-- Add project_id columns as nullable first; they'll be backfilled by data migration script
ALTER TABLE "contentbot"."article_generation" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
ALTER TABLE "contentbot"."article_settings" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
ALTER TABLE "contentbot"."articles" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
ALTER TABLE "contentbot"."generation_queue" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
ALTER TABLE "contentbot"."webhook_deliveries" ADD COLUMN IF NOT EXISTS "project_id" integer;--> statement-breakpoint
-- Add foreign keys (will allow NULLs until backfilled)
DO $$ BEGIN
	ALTER TABLE "contentbot"."article_generation" ADD CONSTRAINT "article_generation_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "contentbot"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contentbot"."article_settings" ADD CONSTRAINT "article_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "contentbot"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contentbot"."articles" ADD CONSTRAINT "articles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "contentbot"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contentbot"."generation_queue" ADD CONSTRAINT "generation_queue_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "contentbot"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "contentbot"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "contentbot"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX "article_generation_project_id_idx" ON "contentbot"."article_generation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "article_settings_project_id_idx" ON "contentbot"."article_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "articles_project_id_idx" ON "contentbot"."articles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "generation_queue_project_id_idx" ON "contentbot"."generation_queue" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_project_id_idx" ON "contentbot"."webhook_deliveries" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "contentbot"."article_settings" DROP COLUMN "user_id";