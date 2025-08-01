import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Started - Contentbot",
  description: "Set up your account to start creating SEO-optimized content",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Contentbot
            </h1>
            <p className="text-gray-600">
              Let&apos;s set up your account to start generating amazing content
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
