CREATE TABLE "topicowl"."reddit_automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer NOT NULL,
	"status" text NOT NULL,
	"results" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topicowl"."reddit_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workflow" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP INDEX "topicowl"."reddit_posts_status_idx";--> statement-breakpoint
DROP INDEX "topicowl"."reddit_posts_scheduled_idx";--> statement-breakpoint
DROP INDEX "topicowl"."reddit_posts_user_project_idx";--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_automation_runs" ADD CONSTRAINT "reddit_automation_runs_automation_id_reddit_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "topicowl"."reddit_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_automations" ADD CONSTRAINT "reddit_automations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE cascade ON UPDATE no action;