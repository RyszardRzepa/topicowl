ALTER TABLE "contentbot"."user_credits" DROP CONSTRAINT "user_credits_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contentbot"."user_credits" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "contentbot"."user_credits" ALTER COLUMN "id" SET DEFAULT 'BEPU7GKU';--> statement-breakpoint
ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT '5482QQ22';