import { db } from "@/server/db";
import { userCredits } from "@/server/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

/**
 * Get the current credit balance for a user
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const [creditRecord] = await db
      .select({ amount: userCredits.amount })
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1);

    // If no credits record exists, create one with default credits
    if (!creditRecord) {
      console.log(
        `No credits record found for user ${userId}, creating with 3 credits`,
      );

      try {
        await db.insert(userCredits).values({
          userId: userId,
          amount: 3,
        });
        return 3;
      } catch (insertError) {
        // Handle race condition where another process might have created the record
        console.warn(
          "Failed to create credits record, attempting to fetch again:",
          insertError,
        );

        const [retryRecord] = await db
          .select({ amount: userCredits.amount })
          .from(userCredits)
          .where(eq(userCredits.userId, userId))
          .limit(1);

        return retryRecord?.amount ?? 0;
      }
    }

    return creditRecord.amount;
  } catch (error) {
    console.error("Error getting user credits:", error);
    throw error;
  }
}

/**
 * Check if a user has any credits available
 */
export async function hasCredits(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits > 0;
}

/**
 * Atomically deduct 1 credit from a user's account
 * Returns true if successful, false if insufficient credits or error
 */
export async function deductCredit(userId: string): Promise<boolean> {
  try {
    // Only decrement when current amount > 0 to avoid negative balances.
    // Using a single UPDATE with a guard ensures atomicity at the DB level.
    const result = await db
      .update(userCredits)
      .set({
        amount: sql`amount - 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(userCredits.userId, userId), gt(userCredits.amount, 0)))
      .returning({ newAmount: userCredits.amount });

    const updatedRecord = result[0];
    if (!updatedRecord) {
      // No row matched (either no record or zero credits)
      return false;
    }
    return updatedRecord.newAmount >= 0; // Should always be true if guard worked
  } catch (error) {
    console.error("Failed to deduct credit", { userId, error });
    return false;
  }
}

/**
 * Add credits to a user's account (used for initial allocation)
 */
export async function addCredits(
  userId: string,
  amount: number,
): Promise<void> {
  await db
    .insert(userCredits)
    .values({
      userId: userId,
      amount: amount,
    })
    .onConflictDoUpdate({
      target: userCredits.userId,
      set: {
        amount: sql`${userCredits.amount} + ${amount}`,
        updatedAt: new Date(),
      },
    });
}
