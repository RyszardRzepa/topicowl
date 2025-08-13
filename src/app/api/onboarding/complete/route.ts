import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, articleSettings, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { prompts } from "@/prompts";

// Types colocated with this API route
export interface CompleteOnboardingRequest {
  skipWebsiteAnalysis?: boolean;
  projectData?: {
    name: string;
    websiteUrl: string;
    companyName: string;
    productDescription: string;
    keywords: string[];
    toneOfVoice?: string;
    industryCategory?: string;
    targetAudience?: string;
    articleStructure?: string;
    maxWords?: number;
    publishingFrequency?: string;
  };
}

export interface CompleteOnboardingResponse {
  success: boolean;
  data?: {
    onboardingCompleted: boolean;
    message: string;
    projectId?: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
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

    // Parse request body
    const body = await request.json() as CompleteOnboardingRequest;
    const { projectData } = body;

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

    let newProjectId: number | undefined;

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

      // Create project if project data is provided
      if (projectData) {
        const [createdProject] = await tx
          .insert(projects)
          .values({
            userId: userId,
            name: projectData.name,
            websiteUrl: projectData.websiteUrl,
            domain: new URL(projectData.websiteUrl).hostname,
            companyName: projectData.companyName,
            productDescription: projectData.productDescription,
            keywords: projectData.keywords,
            toneOfVoice: projectData.toneOfVoice,
            articleStructure: projectData.articleStructure,
            maxWords: projectData.maxWords ?? 800,
          })
          .returning({ id: projects.id });

        if (createdProject) {
          newProjectId = createdProject.id;

          // Create project-specific article settings
          await tx.insert(articleSettings).values({
            projectId: createdProject.id,
            toneOfVoice: projectData.toneOfVoice ?? "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
            articleStructure: projectData.articleStructure ?? prompts.articleStructure(),
            maxWords: projectData.maxWords ?? 800,
            excludedDomains: [],
          });
        }
      }
    });

    console.log(`Onboarding completed for user ${userId}${newProjectId ? ` with project ${newProjectId}` : ''}`);

    const response: CompleteOnboardingResponse = {
      success: true,
      data: {
        onboardingCompleted: true,
        message: "Onboarding completed successfully",
        projectId: newProjectId,
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