import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { OnboardingChecker } from "@/components/auth/onboarding-checker";
import { ProjectRequiredChecker } from "@/components/auth/project-required-checker";
import { CreditProvider } from "@/components/dashboard/credit-context";
import { ProjectProvider } from "@/contexts/project-context";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up");
  }

  return (
    <OnboardingChecker>
      <ProjectProvider>
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
