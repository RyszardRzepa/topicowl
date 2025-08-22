ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'XNKDFWGB';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "meta_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL;