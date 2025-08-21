"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { HeaderLogo } from "@/components/layout/header-logo";

export function ConditionalHeader() {
  const pathname = usePathname();

  // Don't show header on dashboard routes
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <HeaderLogo />
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/settings"
              className="flex items-center space-x-2 rounded-md px-3 py-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
