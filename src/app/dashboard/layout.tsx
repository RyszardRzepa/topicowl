import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { CreditProvider } from "@/components/dashboard/credit-context";
import { ProjectProvider } from "@/contexts/project-context";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up");
  }

  // Only check if user exists and is onboarded - minimal server-side check
  try {
    const [user] = await db
      .select({ 
        id: users.id,
        onboardingCompleted: users.onboardingCompleted 
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      redirect("/onboarding");
    }

    if (!user.onboardingCompleted) {
      redirect("/onboarding");
    }
  } catch (error) {
    console.error("Database error checking user status:", error);
    redirect("/onboarding");
  }

  // Don't fetch projects server-side - let client handle it
  return (
    <>
      <ProjectProvider>
        <CreditProvider>
          <DashboardLayoutClient>{children}</DashboardLayoutClient>
        </CreditProvider>
      </ProjectProvider>
      <Toaster />
    </>
  );
}
