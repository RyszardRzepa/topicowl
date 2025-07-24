ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT '4K9F9Z5S';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "generation_progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "clicks" integer DEFAULT 0 NOT NULL;