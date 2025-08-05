ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT 'DVRVV76C';--> statement-breakpoint
ALTER TABLE "contentbot"."articles" ADD COLUMN "publish_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "scheduled_at";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "scheduling_type";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "scheduling_frequency";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "scheduling_frequency_config";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "next_schedule_at";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "last_scheduled_at";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "schedule_count";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "is_recurring_schedule";--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "optimized_content";