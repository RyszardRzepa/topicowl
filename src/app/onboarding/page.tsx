"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { WebsiteUrlForm } from "@/components/onboarding/website-url-form";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { AIAnalysisPreview } from "@/components/onboarding/ai-analysis-preview";
import type { AnalyzeWebsiteResponse } from "@/app/api/onboarding/analyze-website/route";

type OnboardingStep = "url" | "analyzing" | "review" | "complete";

type AnalysisData = {
  domain: string;
  companyName: string;
  productDescription: string;
  toneOfVoice: string;
  suggestedKeywords: string[];
  industryCategory: string;
  targetAudience: string;
  contentStrategy: {
    articleStructure: string;
    maxWords: number;
    publishingFrequency: string;
  };
};

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("url");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already onboarded
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isLoaded || !user) return;
      
      try {
        const response = await fetch("/api/onboarding/status");
        if (response.ok) {
          const data = await response.json() as { onboarding_completed: boolean };
          if (data.onboarding_completed) {
            router.push("/");
            return;
          }
        }
      } catch (err) {
        console.error("Error checking onboarding status:", err);
      }
    };

    void checkOnboardingStatus();
  }, [isLoaded, user, router]);

  const handleUrlSubmit = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentStep("analyzing");

    try {
      const response = await fetch("/api/onboarding/analyze-website", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl: url,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze website");
      }

      const result: AnalyzeWebsiteResponse = await response.json();
      
      if (result.success && result.data) {
        setAnalysisData(result.data);
        setCurrentStep("review");
      } else {
        throw new Error(result.error ?? "Analysis failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCurrentStep("url");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisConfirm = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to complete onboarding");
      }

      setCurrentStep("complete");
      
      // Redirect to main app after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldEdit = async (field: string, value: unknown) => {
    if (!analysisData) return;

    // Update local state
    setAnalysisData({
      ...analysisData,
      [field]: value,
    });

    // You can implement API call to save partial updates here if needed
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  return (
    <div className="space-y-8">
      <OnboardingProgress currentStep={currentStep} />
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {currentStep === "url" && (
        <WebsiteUrlForm
          onSubmit={handleUrlSubmit}
          isLoading={isLoading}
        />
      )}

      {currentStep === "analyzing" && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Analyzing Your Website
          </h3>
          <p className="text-gray-600">
            Our AI is analyzing your website to create personalized content settings...
          </p>
        </div>
      )}

      {currentStep === "review" && analysisData && (
        <AIAnalysisPreview
          analysisData={analysisData}
          onConfirm={handleAnalysisConfirm}
          onEdit={handleFieldEdit}
          isLoading={isLoading}
        />
      )}

      {currentStep === "complete" && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            All Set!
          </h3>
          <p className="text-gray-600">
            Your account is configured. Redirecting to the dashboard...
          </p>
        </div>
      )}
    </div>
  );
}
