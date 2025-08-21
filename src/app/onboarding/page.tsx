"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { WebsiteUrlForm } from "@/components/onboarding/website-url-form";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { AIAnalysisPreview } from "@/components/onboarding/ai-analysis-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  };
};

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { switchProject, refreshProjects } = useProject();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("url");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note: Onboarding status check is now handled by OnboardingChecker component in layout

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

      const result = (await response.json()) as AnalyzeWebsiteResponse;

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
    if (!analysisData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectData: {
            name: `${analysisData.companyName} Website`,
            websiteUrl: `https://${analysisData.domain}`,
            companyName: analysisData.companyName,
            productDescription: analysisData.productDescription,
            keywords: analysisData.suggestedKeywords,
            toneOfVoice: analysisData.toneOfVoice,
            articleStructure: analysisData.contentStrategy.articleStructure,
            maxWords: analysisData.contentStrategy.maxWords,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete onboarding");
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { projectId?: number };
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error ?? "Failed to complete onboarding");
      }

      // Refresh projects list and switch to the newly created project
      await refreshProjects();

      if (result.data?.projectId) {
        await switchProject(result.data.projectId);
      }

      setCurrentStep("complete");

      // Redirect to main app after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldEdit = async (field: string, value: unknown) => {
    if (!analysisData) return;

    const updatedData = { ...analysisData };

    if (field.includes(".")) {
      // Handle nested fields like 'contentStrategy.maxWords'
      const [parent, child] = field.split(".");
      if (parent === "contentStrategy") {
        updatedData.contentStrategy = {
          ...updatedData.contentStrategy,
          [child as keyof typeof updatedData.contentStrategy]: value as never,
        };
      }
    } else if (field === "suggestedKeywords") {
      updatedData[field] = value as string[];
    } else {
      updatedData[field as keyof AnalysisData] = value as never;
    }

    // Update local state
    setAnalysisData(updatedData);

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
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {error.includes("analyze") && (
              <div className="mt-2 text-sm">
                Please check your website URL and try again. Make sure the
                website is accessible and contains enough content to analyze.
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {currentStep === "url" && (
        <WebsiteUrlForm onSubmit={handleUrlSubmit} isLoading={isLoading} />
      )}

      {currentStep === "analyzing" && (
        <Card className="text-center">
          <CardContent>
            <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <CardTitle className="mb-2">Analyzing Your Website</CardTitle>
            <CardDescription>
              Our AI is analyzing your website to create personalized content
              settings...
            </CardDescription>
          </CardContent>
        </Card>
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
        <Card className="text-center">
          <CardContent>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="mb-2">All Set!</CardTitle>
            <CardDescription>
              Your account is configured. Redirecting to the dashboard...
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
