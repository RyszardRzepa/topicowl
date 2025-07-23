CREATE SCHEMA "content-machine";
--> statement-breakpoint
CREATE TYPE "public"."article_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('idea', 'to_generate', 'generating', 'wait_for_publish', 'published');--> statement-breakpoint
CREATE TABLE "content-machine"."article_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"tone_of_voice" text,
	"article_structure" text,
	"max_words" integer DEFAULT 800,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content-machine"."articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" varchar(255),
	"status" "article_status" DEFAULT 'idea' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"priority" "article_priority" DEFAULT 'medium' NOT NULL,
	"estimated_read_time" integer,
	"kanban_position" integer DEFAULT 0 NOT NULL,
	"meta_description" varchar(255),
	"outline" jsonb,
	"draft" text,
	"optimized_content" text,
	"fact_check_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_score" integer,
	"internal_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_task_id" varchar,
	"generation_scheduled_at" timestamp with time zone,
	"generation_started_at" timestamp with time zone,
	"generation_completed_at" timestamp with time zone,
	"generation_error" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content-machine"."users" (
	"id" text PRIMARY KEY DEFAULT 'N8WRS3DW' NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"domain" text,
	"product_description" text,
	"keywords" jsonb,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "content-machine"."article_settings" ADD CONSTRAINT "article_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "content-machine"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD CONSTRAINT "articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "content-machine"."users"("id") ON DELETE no action ON UPDATE no action;