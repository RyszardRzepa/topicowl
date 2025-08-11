import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getUserCredits } from "@/lib/utils/credits";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user record
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, clerkUserId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user credits using utility function
    const credits = await getUserCredits(userRecord.id);

    return NextResponse.json({ credits });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}
