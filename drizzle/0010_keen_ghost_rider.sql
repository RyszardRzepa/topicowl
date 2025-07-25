CREATE TABLE "content-machine"."webhook_deliveries" (
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
ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'WGPYAYUJ';--> statement-breakpoint
ALTER TABLE "content-machine"."users" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "content-machine"."users" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "content-machine"."users" ADD COLUMN "webhook_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content-machine"."users" ADD COLUMN "webhook_events" jsonb DEFAULT '["article.published"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content-machine"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "content-machine"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content-machine"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content-machine"."articles"("id") ON DELETE no action ON UPDATE no action;