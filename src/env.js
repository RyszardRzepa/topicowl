import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
    ANTHROPIC_API_KEY: z.string(),
    CLERK_SECRET_KEY: z.string(),
    CLERK_WEBHOOK_SECRET: z.string(),
    UNSPLASH_ACCESS_KEY: z.string().min(1),
    UNSPLASH_SECRET_KEY: z.string().min(1).optional(),
    PEXELS_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string(),
    JINA_API_KEY: z.string(),
    PARALLEL_API_KEY: z.string(),
    PARALLEL_WEBHOOK_SECRET: z.string(),

    // Reddit OAuth configuration
    REDDIT_CLIENT_ID: z.string().min(1),
    REDDIT_CLIENT_SECRET: z.string().min(1),

    // X (Twitter) OAuth 2.0 configuration
    X_CLIENT_ID: z.string().min(1),
    X_CLIENT_SECRET: z.string().min(1),

    // Webhook configuration
    WEBHOOK_TIMEOUT_MS: z.string().default("30000"),
    WEBHOOK_MAX_RETRIES: z.string().default("3"),
    WEBHOOK_RETRY_BASE_DELAY: z.string().default("30"),
    WEBHOOK_RATE_LIMIT_PER_HOUR: z.string().default("100"),
    WEBHOOK_REQUIRE_HTTPS: z.string().default("true"),

    STRIPE_PRIVATE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    CF_ACCOUNT_ID: z.string(),
    CF_API_TOKEN: z.string(),

    BLOB_READ_WRITE_TOKEN: z.string(),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    UNSPLASH_SECRET_KEY: process.env.UNSPLASH_SECRET_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,

    // Webhook configuration
    WEBHOOK_TIMEOUT_MS: process.env.WEBHOOK_TIMEOUT_MS,
    WEBHOOK_MAX_RETRIES: process.env.WEBHOOK_MAX_RETRIES,
    WEBHOOK_RETRY_BASE_DELAY: process.env.WEBHOOK_RETRY_BASE_DELAY,
    WEBHOOK_RATE_LIMIT_PER_HOUR: process.env.WEBHOOK_RATE_LIMIT_PER_HOUR,
    WEBHOOK_REQUIRE_HTTPS: process.env.WEBHOOK_REQUIRE_HTTPS,

    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    JINA_API_KEY: process.env.JINA_API_KEY,
    PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
    PARALLEL_WEBHOOK_SECRET: process.env.PARALLEL_WEBHOOK_SECRET,

    // Reddit OAuth configuration
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,

    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
    CF_API_TOKEN: process.env.CF_API_TOKEN,

    // X (Twitter) OAuth 2.0 configuration
    X_CLIENT_ID: process.env.X_CLIENT_ID,
    X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,

    STRIPE_PRIVATE_KEY: process.env.STRIPE_PRIVATE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,

    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
