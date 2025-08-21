CREATE SCHEMA "topicowl";
--> statement-breakpoint
CREATE TYPE "topicowl"."article_status" AS ENUM('idea', 'scheduled', 'queued', 'to_generate', 'generating', 'wait_for_publish', 'published', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "topicowl"."api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "topicowl"."article_generation" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"task_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"outline" jsonb,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"research_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_content" text,
	"validation_report" text,
	"quality_control_report" text,
	"seo_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"write_prompt" text,
	"related_articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
CREATE TABLE "topicowl"."article_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tone_of_voice" text,
	"article_structure" text,
	"max_words" integer DEFAULT 800,
	"excluded_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sitemap_url" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "article_settings_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "topicowl"."articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"project_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" varchar(255),
	"status" "topicowl"."article_status" DEFAULT 'idea' NOT NULL,
	"publish_scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"estimated_read_time" integer,
	"kanban_position" integer DEFAULT 0 NOT NULL,
	"slug" varchar(255),
	"meta_description" varchar(255),
	"meta_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" text,
	"content" text,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fact_check_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_score" integer,
	"internal_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_image_url" text,
	"cover_image_alt" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topicowl"."generation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
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
CREATE TABLE "topicowl"."payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"amount" integer NOT NULL,
	"credits" integer NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "topicowl"."projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text NOT NULL,
	"domain" text,
	"company_name" text,
	"product_description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone_of_voice" text,
	"article_structure" text,
	"max_words" integer DEFAULT 800,
	"excluded_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sitemap_url" text,
	"webhook_url" text,
	"webhook_secret" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_events" jsonb DEFAULT '["article.published"]'::jsonb NOT NULL,
	"include_video" boolean DEFAULT true NOT NULL,
	"include_tables" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topicowl"."reddit_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"subreddit" varchar(255) NOT NULL,
	"title" varchar(300) NOT NULL,
	"text" text NOT NULL,
	"status" "topicowl"."article_status" DEFAULT 'scheduled' NOT NULL,
	"publish_scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topicowl"."user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "topicowl"."users" (
	"id" text PRIMARY KEY NOT NULL,
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
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "topicowl"."webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
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
ALTER TABLE "topicowl"."api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ADD CONSTRAINT "article_generation_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "topicowl"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ADD CONSTRAINT "article_generation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" ADD CONSTRAINT "article_generation_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_settings" ADD CONSTRAINT "article_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ADD CONSTRAINT "articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ADD CONSTRAINT "articles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."generation_queue" ADD CONSTRAINT "generation_queue_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "topicowl"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."generation_queue" ADD CONSTRAINT "generation_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."generation_queue" ADD CONSTRAINT "generation_queue_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ADD CONSTRAINT "reddit_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ADD CONSTRAINT "reddit_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "topicowl"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_project_id_idx" ON "topicowl"."api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "article_generation_project_id_idx" ON "topicowl"."article_generation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "article_settings_project_id_idx" ON "topicowl"."article_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "articles_project_id_idx" ON "topicowl"."articles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "generation_queue_project_id_idx" ON "topicowl"."generation_queue" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "topicowl"."payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_stripe_payment_intent_id_idx" ON "topicowl"."payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "topicowl"."projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_domain_idx" ON "topicowl"."projects" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "projects_user_domain_idx" ON "topicowl"."projects" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "reddit_posts_project_id_idx" ON "topicowl"."reddit_posts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reddit_posts_status_idx" ON "topicowl"."reddit_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reddit_posts_scheduled_idx" ON "topicowl"."reddit_posts" USING btree ("publish_scheduled_at");--> statement-breakpoint
CREATE INDEX "reddit_posts_user_project_idx" ON "topicowl"."reddit_posts" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_project_id_idx" ON "topicowl"."webhook_deliveries" USING btree ("project_id");