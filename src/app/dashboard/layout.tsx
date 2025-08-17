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
import { projects } from "@/server/db/schema";
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

  // Fetch user's projects for SSR hydration
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
      <Toaster />
    </OnboardingChecker>
  );
}
