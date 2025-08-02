import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { OnboardingChecker } from "@/components/auth/onboarding-checker";
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
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
      <Toaster />
    </OnboardingChecker>
  );
}
