import "@/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "@/components/PostHogProvider";

import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Quality content marketing on autopilot",
  description:
    "AI that researches, writes, and fact-checks your content. Optimized for SEO & AI ranking. Schedule to blog, reddit.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "Quality content marketing on autopilot",
    description:
      "AI that researches, writes, and fact-checks your content. Optimized for SEO & AI ranking. Schedule to blog, reddit.",
    images: [
      {
        url: "/og-preview.png",
        width: 1200,
        height: 630,
        alt: "Topicowl - Quality content marketing on autopilot",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quality content marketing on autopilot",
    description:
      "AI that researches, writes, and fact-checks your content. Optimized for SEO & AI ranking. Schedule to blog, reddit.",
    images: ["/og-preview.png"],
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
