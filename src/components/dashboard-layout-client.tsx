"use client";

import React, { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Menu, X, Settings } from "lucide-react";
import { DashboardNav } from "@/components/dashboard-nav";
import { CreditBalance } from "@/components/dashboard/credit-balance";
import { ProjectSwitcher } from "@/components/project-switcher";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProjectRequiredChecker } from "@/components/auth/project-required-checker";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  const isSettingsActive = pathname?.startsWith("/dashboard/settings");

  return (
    <ProjectRequiredChecker>
      <div className="bg-background flex h-screen">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] transform flex-col border-r border-stone-200 bg-white transition-transform duration-300 ease-in-out lg:relative lg:max-w-none lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex-1 p-4">
            <div className="mb-6 lg:block">
              <div className="flex items-center justify-between lg:block">
                <ProjectSwitcher className="w-full" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-md p-1 hover:bg-stone-100 lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <DashboardNav />
          </div>

          <div className="border-t border-stone-200 p-4">
            <Button
              asChild
              variant={isSettingsActive ? "default" : "ghost"}
              className={cn(
                "h-auto w-full justify-start py-2.5 text-sm",
                isSettingsActive
                  ? "font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Link href="/dashboard/settings">
                <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="truncate">Settings</span>
              </Link>
            </Button>
          </div>

          <CreditBalance />
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="h-14 flex-shrink-0 border-b border-stone-200 bg-white sm:h-16">
            <div className="flex h-full items-center justify-between px-3 sm:px-4 lg:px-6">
              <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex-shrink-0 rounded-md p-1 hover:bg-stone-100 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Breadcrumb items={breadcrumbs} className="min-w-0 flex-1" />
              </div>
              <div className="flex-shrink-0">
                <UserButton />
              </div>
            </div>
          </header>
          <main className="relative flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 lg:p-6">
            {/* Pattern Background */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 1px 1px, rgb(156 163 175) 1px, transparent 0)
                `,
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative z-10">{children}</div>
          </main>
        </div>
      </div>
    </ProjectRequiredChecker>
  );
}
