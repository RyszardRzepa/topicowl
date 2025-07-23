import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Server-side authentication helper that ensures a user is signed in.
 * Redirects to sign-in if not authenticated.
 * @returns Promise<{ userId: string }>
 */
export async function requireAuth() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  return { userId };
}

/**
 * Server-side authentication helper that gets the current user ID if signed in.
 * Returns null if not authenticated (doesn't redirect).
 * @returns Promise<string | null>
 */
export async function getCurrentUserId() {
  const { userId } = await auth();
  return userId;
}
