CREATE TABLE "topicowl"."reddit_processed_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"post_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"post_title" text NOT NULL,
	"post_url" text NOT NULL,
	"evaluation_score" integer,
	"was_approved" boolean DEFAULT false NOT NULL,
	"evaluation_reasoning" text,
	"reply_content" text,
	"reply_posted" boolean DEFAULT false NOT NULL,
	"reply_posted_at" timestamp with time zone,
	"automation_id" integer,
	"run_id" integer,
	"processed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_processed_posts" ADD CONSTRAINT "reddit_processed_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_processed_posts" ADD CONSTRAINT "reddit_processed_posts_automation_id_reddit_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "topicowl"."reddit_automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_processed_posts" ADD CONSTRAINT "reddit_processed_posts_run_id_reddit_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "topicowl"."reddit_automation_runs"("id") ON DELETE set null ON UPDATE no action;