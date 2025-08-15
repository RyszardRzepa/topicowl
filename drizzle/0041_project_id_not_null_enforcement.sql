-- Enforce NOT NULL on project_id columns after backfill
-- Safe because data migration script populated project_id for existing rows

ALTER TABLE "contentbot"."article_generation" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "contentbot"."article_settings" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "contentbot"."articles" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "contentbot"."generation_queue" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "contentbot"."webhook_deliveries" ALTER COLUMN "project_id" SET NOT NULL;
