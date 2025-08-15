import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserCredits } from "@/lib/utils/credits";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user credits using utility function directly with Clerk user ID
    const credits = await getUserCredits(clerkUserId);

    return NextResponse.json({ credits });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}
