"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { DashboardNav } from "@/components/dashboard-nav";
import { SettingsDropdown } from "@/components/settings-dropdown";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileDashboardLayout>{children}</MobileDashboardLayout>
      </div>

      {/* Desktop Layout */}
      <div className="bg-background hidden h-screen lg:flex">
        {/* Desktop Sidebar */}
        <div className="flex w-64 flex-shrink-0 flex-col border-r border-stone-200 bg-white">
          <div className="flex-1 p-4">
            <Link href="/dashboard" className="block">
              <h2 className="text-lg font-semibold text-stone-900">
                Contentbot
              </h2>
            </Link>
            <DashboardNav />
          </div>

          {/* Bottom Section */}
          <div className="border-t border-stone-200 p-4">
            <div className="space-y-2">
              <SettingsDropdown />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="h-16 flex-shrink-0 border-b border-stone-200 bg-white">
            <div className="flex h-full items-center justify-between px-6">
              <h1 className="text-lg font-medium text-stone-900">Dashboard</h1>
              <UserButton />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function MobileDashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-background flex h-screen">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] transform flex-col border-r border-stone-200 bg-white transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 p-4">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/dashboard" className="block">
              <h2 className="text-lg font-semibold text-stone-900">
                Contentbot
              </h2>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1 hover:bg-stone-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <DashboardNav />
        </div>

        {/* Bottom Section */}
        <div className="border-t border-stone-200 p-4">
          <div className="space-y-2">
            <SettingsDropdown />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="h-14 flex-shrink-0 border-b border-stone-200 bg-white sm:h-16">
          <div className="flex h-full items-center justify-between px-3 sm:px-4">
            <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex-shrink-0 rounded-md p-1 hover:bg-stone-100"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="truncate text-base font-medium text-stone-900 sm:text-lg">
                Dashboard
              </h1>
            </div>
            <div className="flex-shrink-0">
              <UserButton />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
