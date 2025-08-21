import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProjectProvider } from "@/contexts/project-context";

export const metadata: Metadata = {
  title: "Getting Started - Contentbot",
  description: "Set up your account to start creating SEO-optimized content",
};

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold text-gray-900">
                Welcome to Contentbot
              </h1>
              <p className="text-gray-600">
                Let&apos;s set up your account to start generating amazing
                content
              </p>
            </div>

            <div className="rounded-lg bg-white p-8 shadow-lg">{children}</div>
          </div>
        </div>
      </div>
    </ProjectProvider>
  );
}
