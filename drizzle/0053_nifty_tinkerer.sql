CREATE TABLE "topicowl"."reddit_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"tasks_per_day" integer DEFAULT 5,
	"comment_ratio" integer DEFAULT 80,
	"target_subreddits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expertise_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_generate_weekly" boolean DEFAULT true,
	"last_generated_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topicowl"."reddit_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"task_order" integer DEFAULT 1,
	"task_type" varchar(20) NOT NULL,
	"subreddit" varchar(255) NOT NULL,
	"search_keywords" text,
	"prompt" text NOT NULL,
	"ai_draft" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reddit_url" text,
	"completed_at" timestamp with time zone,
	"karma_earned" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_settings" ADD CONSTRAINT "reddit_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_settings" ADD CONSTRAINT "reddit_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_tasks" ADD CONSTRAINT "reddit_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_tasks" ADD CONSTRAINT "reddit_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reddit_settings_project_unique_idx" ON "topicowl"."reddit_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reddit_tasks_project_date_idx" ON "topicowl"."reddit_tasks" USING btree ("project_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "reddit_tasks_status_idx" ON "topicowl"."reddit_tasks" USING btree ("status");