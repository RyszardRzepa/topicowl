import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { OnboardingChecker } from "@/components/auth/onboarding-checker";
import { ProjectRequiredChecker } from "@/components/auth/project-required-checker";
import { CreditProvider } from "@/components/dashboard/credit-context";
import { ProjectProvider } from "@/contexts/project-context";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/server/db";
import { projects, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { Project } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up");
  }

  // Check onboarding status on server-side first
  let user;
  try {
    const result = await db
      .select({ onboardingCompleted: users.onboardingCompleted })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    user = result[0];
  } catch (error) {
    console.error("Database error checking onboarding status:", error);
    // If we can't check onboarding status due to database error, redirect to onboarding for safety
    // The onboarding API will handle creating the user record if needed
    redirect("/onboarding");
  }

  // If user doesn't exist in database yet (webhook hasn't processed), redirect to onboarding
  if (!user) {
    console.log(`User ${userId} not found in database, redirecting to onboarding`);
    redirect("/onboarding");
  }

  // If user exists but hasn't completed onboarding, redirect to onboarding
  if (!user.onboardingCompleted) {
    console.log(`User ${userId} hasn't completed onboarding, redirecting`);
    redirect("/onboarding");
  }

  console.log(`User ${userId} is onboarded, proceeding to dashboard`);

  // Only fetch projects if user is onboarded
  let initialProjects: Project[] = [];
  let initialProject: Project | undefined = undefined;

  try {
    // Get all user projects
    initialProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.createdAt);

    // Try to get current project from cookie
    const cookieStore = await cookies();
    const currentProjectIdCookie = cookieStore.get("currentProjectId");

    if (currentProjectIdCookie && initialProjects.length > 0) {
      const currentProjectId = parseInt(currentProjectIdCookie.value, 10);
      initialProject =
        initialProjects.find((p) => p.id === currentProjectId) ??
        initialProjects[0];
    } else if (initialProjects.length > 0) {
      initialProject = initialProjects[0];
    }
  } catch (error) {
    console.error("Error fetching initial projects:", error);
    // Continue with empty arrays - client will handle loading
  }

  return (
    <>
      <OnboardingChecker>
        <ProjectProvider
          initialProjects={initialProjects}
          initialProject={initialProject}
        >
          <ProjectRequiredChecker>
            <CreditProvider>
              <DashboardLayoutClient>{children}</DashboardLayoutClient>
            </CreditProvider>
          </ProjectRequiredChecker>
        </ProjectProvider>
      </OnboardingChecker>
      <Toaster />
    </>
  );
}
