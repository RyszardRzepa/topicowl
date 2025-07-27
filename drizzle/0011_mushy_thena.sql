ALTER TYPE "public"."article_status" ADD VALUE 'scheduled' BEFORE 'to_generate';--> statement-breakpoint
ALTER TYPE "public"."article_status" ADD VALUE 'queued' BEFORE 'to_generate';--> statement-breakpoint
CREATE TABLE "content-machine"."generation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" text NOT NULL,
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
ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT '7XXP4SHT';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "scheduling_type" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "scheduling_frequency" varchar(20);--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "scheduling_frequency_config" jsonb;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "next_schedule_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "last_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "schedule_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "is_recurring_schedule" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD COLUMN "parent_article_id" integer;--> statement-breakpoint
ALTER TABLE "content-machine"."generation_queue" ADD CONSTRAINT "generation_queue_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content-machine"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content-machine"."generation_queue" ADD CONSTRAINT "generation_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "content-machine"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content-machine"."articles" ADD CONSTRAINT "articles_parent_article_id_articles_id_fk" FOREIGN KEY ("parent_article_id") REFERENCES "content-machine"."articles"("id") ON DELETE no action ON UPDATE no action;