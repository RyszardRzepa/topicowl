ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT '8YKFNQJW';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "videos" jsonb DEFAULT '[]'::jsonb NOT NULL;