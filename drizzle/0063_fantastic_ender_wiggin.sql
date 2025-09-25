DROP TABLE IF EXISTS "topicowl"."social_posts" CASCADE;
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;
ALTER TABLE IF EXISTS "topicowl"."social_posts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE IF EXISTS "topicowl"."social_posts" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;
ALTER TABLE "topicowl"."articles" ALTER COLUMN "status" SET DEFAULT 'idea';
ALTER TABLE "topicowl"."reddit_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled';
