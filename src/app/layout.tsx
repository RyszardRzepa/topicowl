import "@/styles/globals.css";
import { Inter } from "next/font/google";

import { type Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI SEO Content Machine",
  description: "Create, manage, and publish SEO-optimized articles with AI-powered workflows",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-white text-stone-700 text-15 leading-relaxed`}>{children}</body>
    </html>
  );
}
