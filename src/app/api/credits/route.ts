import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserCredits } from "@/lib/utils/credits";
import { logServerError } from "@/lib/posthog-server";

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
    await logServerError(error, { operation: "get_credits" });

    return NextResponse.json(
      { error: "Error fetching user credits. Try gain." },
      { status: 500 },
    );
  }
}
