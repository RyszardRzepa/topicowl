import { auth } from "@clerk/nextjs/server";
import { PostHog } from "posthog-node";

export default function getPostHogServer() {
  const posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}

export async function logServerError(
  error: unknown,
  params: { operation: string },
) {
  // Do not send PostHog events in development
  if (process.env.NODE_ENV !== "production") {
    // Still log to console for local visibility
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error(
      `[DEV SERVER ERROR] Operation: ${params.operation} | Error: ${errorObj.message}${errorObj.stack ? "\nStack: " + errorObj.stack : ""}`,
    );
    return;
  }
  const { userId } = await auth().catch();

  // Convert unknown error to Error object for PostHog
  const errorObj = error instanceof Error ? error : new Error(String(error));

  console.error(
    `[SERVER ERROR] Operation: ${params.operation} | User: ${userId ?? "anonymous"} | Error: ${errorObj.message}${errorObj.stack ? "\nStack: " + errorObj.stack : ""}`,
  );

  if (userId) {
    getPostHogServer().captureException(errorObj, userId, params);
  } else {
    getPostHogServer().captureException(errorObj, "anonymous", params);
  }
}
