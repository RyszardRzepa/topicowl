ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT '5FFTUFHZ';--> statement-breakpoint
ALTER TABLE "contentbot"."articles" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "contentbot"."articles" DROP COLUMN "outline";