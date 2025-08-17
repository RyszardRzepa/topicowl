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
ALTER TABLE "topicowl"."reddit_posts" ADD CONSTRAINT "reddit_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "topicowl"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topicowl"."reddit_posts" ADD CONSTRAINT "reddit_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "topicowl"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reddit_posts_project_id_idx" ON "topicowl"."reddit_posts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reddit_posts_status_idx" ON "topicowl"."reddit_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reddit_posts_scheduled_idx" ON "topicowl"."reddit_posts" USING btree ("publish_scheduled_at");--> statement-breakpoint
CREATE INDEX "reddit_posts_user_project_idx" ON "topicowl"."reddit_posts" USING btree ("user_id","project_id");