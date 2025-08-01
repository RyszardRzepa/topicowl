import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { OnboardingChecker } from "@/components/auth/onboarding-checker";
import { Toaster } from "@/components/ui/sonner";
import { ConditionalHeader } from "@/components/layout/conditional-header";

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
            <ConditionalHeader />
            {children}
            <Toaster />
          </OnboardingChecker>
        </body>
      </html>
    </ClerkProvider>
  );
}
