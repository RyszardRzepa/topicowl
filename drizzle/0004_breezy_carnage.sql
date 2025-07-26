CREATE TABLE "content-machine"."article_generation" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"task_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"research_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_content" text,
	"validation_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_image_id" text,
	"image_attribution" jsonb,
	"image_query" text,
	"image_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'KC3TYMWH';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "featured_image_alt" text;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "image_attribution" jsonb;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "unsplash_image_id" text;--> statement-breakpoint
ALTER TABLE "content-machine"."article_generation" ADD CONSTRAINT "article_generation_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content-machine"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content-machine"."article_generation" ADD CONSTRAINT "article_generation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "content-machine"."users"("id") ON DELETE no action ON UPDATE no action;