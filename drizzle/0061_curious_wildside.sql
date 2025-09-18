CREATE TABLE "topicowl"."social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "topicowl"."article_status" DEFAULT 'scheduled' NOT NULL,
	"publish_scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ADD CONSTRAINT "social_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."social_posts" ADD CONSTRAINT "social_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_project_id_idx" ON "topicowl"."social_posts" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "topicowl"."articles" DROP COLUMN "draft";--> statement-breakpoint
ALTER TABLE "topicowl"."articles" DROP COLUMN "seo_score";--> statement-breakpoint
ALTER TABLE "topicowl"."articles" DROP COLUMN "fact_check_report";--> statement-breakpoint
ALTER TABLE "topicowl"."articles" DROP COLUMN "internal_links";--> statement-breakpoint
ALTER TABLE "topicowl"."articles" DROP COLUMN "sources";