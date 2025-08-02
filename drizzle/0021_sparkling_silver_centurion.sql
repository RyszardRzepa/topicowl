CREATE SCHEMA "contentbot";
--> statement-breakpoint
CREATE TABLE "contentbot"."article_generation" (
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
	"validation_report" text,
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
CREATE TABLE "contentbot"."article_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"tone_of_voice" text,
	"article_structure" text,
	"max_words" integer DEFAULT 800,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contentbot"."articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" varchar(255),
	"status" "article_status" DEFAULT 'idea' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"scheduling_type" varchar(20) DEFAULT 'manual',
	"scheduling_frequency" varchar(20),
	"scheduling_frequency_config" jsonb,
	"next_schedule_at" timestamp with time zone,
	"last_scheduled_at" timestamp with time zone,
	"schedule_count" integer DEFAULT 0,
	"is_recurring_schedule" boolean DEFAULT false,
	"estimated_read_time" integer,
	"kanban_position" integer DEFAULT 0 NOT NULL,
	"slug" varchar(255),
	"meta_description" varchar(255),
	"meta_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outline" jsonb,
	"draft" text,
	"content" text,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"optimized_content" text,
	"fact_check_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_score" integer,
	"internal_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_image_url" text,
	"cover_image_alt" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contentbot"."generation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"added_to_queue_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"scheduled_for_date" timestamp with time zone,
	"queue_position" integer,
	"scheduling_type" varchar(20) DEFAULT 'manual',
	"status" varchar(20) DEFAULT 'queued',
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contentbot"."users" (
	"id" text PRIMARY KEY DEFAULT 'XNPYE645' NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"domain" text,
	"product_description" text,
	"keywords" jsonb,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"webhook_secret" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_events" jsonb DEFAULT '["article.published"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "contentbot"."webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"article_id" integer NOT NULL,
	"webhook_url" text NOT NULL,
	"event_type" text DEFAULT 'article.published' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivery_time_ms" integer,
	"error_message" text,
	"error_details" jsonb,
	"next_retry_at" timestamp with time zone,
	"retry_backoff_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE "content-machine"."article_generation" CASCADE;--> statement-breakpoint
DROP TABLE "content-machine"."article_settings" CASCADE;--> statement-breakpoint
DROP TABLE "content-machine"."articles" CASCADE;--> statement-breakpoint
DROP TABLE "content-machine"."generation_queue" CASCADE;--> statement-breakpoint
DROP TABLE "content-machine"."users" CASCADE;--> statement-breakpoint
DROP TABLE "content-machine"."webhook_deliveries" CASCADE;--> statement-breakpoint
ALTER TABLE "contentbot"."article_generation" ADD CONSTRAINT "article_generation_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "contentbot"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."article_generation" ADD CONSTRAINT "article_generation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."article_settings" ADD CONSTRAINT "article_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."articles" ADD CONSTRAINT "articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."generation_queue" ADD CONSTRAINT "generation_queue_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "contentbot"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."generation_queue" ADD CONSTRAINT "generation_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contentbot"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "contentbot"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP SCHEMA "content-machine";
