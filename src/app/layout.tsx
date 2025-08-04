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
  title: "Ship content that ranks and converts on autopilot",
  description:
    "For B2B teams and SEO agencies, Contentbot plans topics for you, drafts them on time, and publishes to your blog, X, and Reddit",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "Ship content that ranks and converts on autopilot",
    description:
      " Plan, Generate, Schedule Publishing content for blog, reddit, X.",
    images: [
      {
        url: "/contentbot-preview.png",
        width: 1200,
        height: 630,
        alt: "Contentbot - AI SEO Content Platform",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ship content that ranks and converts on autopilot",
    description:
      "For B2B teams and SEO agencies, Contentbot plans topics for you, drafts them on time, and publishes X account",
    images: ["/contentbot-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`text-15 bg-white font-sans leading-relaxed text-stone-700 antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
