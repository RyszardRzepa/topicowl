import "@/styles/globals.css";
// import { Inter } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Settings } from "lucide-react";
import { OnboardingChecker } from "@/components/auth/onboarding-checker";
import { Toaster } from "@/components/ui/sonner";

import { type Metadata } from "next";

// const inter = Inter({
//   subsets: ["latin"],
//   weight: ["400", "500", "600", "700"],
//   display: "swap",
// });

export const metadata: Metadata = {
  title: "AI SEO Content Machine",
  description: "Create, manage, and publish SEO-optimized articles with AI-powered workflows",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`font-sans antialiased bg-white text-stone-700 text-15 leading-relaxed`}>
          <OnboardingChecker>
            <header className="border-b border-stone-200 bg-white">
              <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <Link href="/" className="text-xl font-semibold text-stone-900 hover:text-stone-700 transition-colors">
                  AI SEO Content Machine
                </Link>
                <div className="flex items-center gap-4">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <Link 
                      href="/settings"
                      className="flex items-center space-x-2 px-3 py-2 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                    <UserButton />
                  </SignedIn>
                </div>
              </div>
            </header>
            {children}
            <Toaster />
          </OnboardingChecker>
        </body>
      </html>
    </ClerkProvider>
  );
}
