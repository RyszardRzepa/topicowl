import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, articleSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Types colocated with this API route
export interface CompleteOnboardingRequest {
  skipWebsiteAnalysis?: boolean;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  data?: {
    onboardingCompleted: boolean;
    message: string;
  };
  error?: string;
}

export async function POST(_request: NextRequest): Promise<Response> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      const response: CompleteOnboardingResponse = {
        success: false,
        error: "Unauthorized",
      };
      return Response.json(response, { status: 401 });
    }

    // Get user record
    const [userRecord] = await db
      .select({ 
        id: users.id, 
        onboardingCompleted: users.onboardingCompleted 
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      const response: CompleteOnboardingResponse = {
        success: false,
        error: "User not found in database",
      };
      return Response.json(response, { status: 404 });
    }

    // Check if onboarding is already completed
    if (userRecord.onboardingCompleted) {
      const response: CompleteOnboardingResponse = {
        success: true,
        data: {
          onboardingCompleted: true,
          message: "Onboarding already completed",
        },
      };
      return Response.json(response);
    }

        // Complete onboarding in a transaction
    await db.transaction(async (tx) => {
      // Mark onboarding as complete
      await tx
        .update(users)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Create default article settings if they don't exist
      const [existingSettings] = await tx
        .select({ id: articleSettings.id })
        .from(articleSettings)
        .where(eq(articleSettings.userId, userRecord.id))
        .limit(1);

      if (!existingSettings) {
        // Create default settings with empty excluded domains
        await tx.insert(articleSettings).values({
          userId: userRecord.id,
          toneOfVoice: "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
          articleStructure: "Introduction • Main points with subheadings • Practical tips • Conclusion",
          maxWords: 800,
          excludedDomains: [],
        });
      }
    });

    console.log(`Onboarding completed for user ${userId}`);

    const response: CompleteOnboardingResponse = {
      success: true,
      data: {
        onboardingCompleted: true,
        message: "Onboarding completed successfully",
      },
    };

    return Response.json(response);

  } catch (error) {
    console.error("Error completing onboarding:", error);

    const response: CompleteOnboardingResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };

    return Response.json(response, { status: 500 });
  }
}