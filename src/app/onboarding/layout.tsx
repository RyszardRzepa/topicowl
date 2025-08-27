import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProjectProvider } from "@/contexts/project-context";
import Link from "next/link";

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
      <div className="min-h-screen bg-[#F6F4ED]">
        {/* Top navbar with just logo */}
        <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-semibold text-gray-900"
            >
              <img src="/logo-text.svg" className="w-32" />
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-lg bg-white p-6 md:p-8">{children}</div>
          </div>
        </div>
      </div>
    </ProjectProvider>
  );
}
