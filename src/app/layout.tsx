import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "@/components/PostHogProvider";

import { type Metadata } from "next";

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
        url: "/og-preview.png",
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
          <PostHogProvider>
            {process.env.NODE_ENV === "production" && <Analytics />}
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
