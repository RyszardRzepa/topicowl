CREATE TABLE "topicowl"."topic_generation_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"topics_generated" integer DEFAULT 0,
	"error" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "topic_generation_tasks_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
ALTER TABLE "topicowl"."topic_generation_tasks" ADD CONSTRAINT "topic_generation_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."topic_generation_tasks" ADD CONSTRAINT "topic_generation_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;