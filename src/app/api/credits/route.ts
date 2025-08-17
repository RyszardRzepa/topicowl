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
    
    // Provide specific error messages based on error type
    let errorMessage = "Failed to fetch credits";
    
    if (error instanceof Error) {
      if (error.message.includes("database")) {
        errorMessage = "Database error occurred while fetching credits. Please try again.";
      } else if (error.message.includes("connection")) {
        errorMessage = "Connection error. Please check your internet connection and try again.";
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
