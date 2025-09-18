CREATE TYPE "topicowl"."article_generation_status" AS ENUM('scheduled', 'research', 'image', 'writing', 'quality-control', 'validating', 'updating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "topicowl"."article_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"task_id" varchar,
	"status" "topicowl"."article_generation_status" DEFAULT 'scheduled' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"artifacts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topicowl"."article_generation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topicowl"."generation_queue" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "topicowl"."article_generation" CASCADE;--> statement-breakpoint
DROP TABLE "topicowl"."generation_queue" CASCADE;--> statement-breakpoint
DROP TABLE "topicowl"."social_posts" CASCADE;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "fact_check_report" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "fact_check_report" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generations" ADD CONSTRAINT "article_generations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "topicowl"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generations" ADD CONSTRAINT "article_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."article_generations" ADD CONSTRAINT "article_generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_generations_project_id_idx" ON "topicowl"."article_generations" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "topicowl"."article_status";--> statement-breakpoint
CREATE TYPE "topicowl"."article_status" AS ENUM('idea', 'scheduled', 'generating', 'wait_for_publish', 'published', 'failed');--> statement-breakpoint
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DATA TYPE "topicowl"."article_status" USING "status"::"topicowl"."article_status";--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DATA TYPE "topicowl"."article_status" USING "status"::"topicowl"."article_status";