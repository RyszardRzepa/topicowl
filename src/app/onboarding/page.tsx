"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { WebsiteUrlForm } from "@/components/onboarding/website-url-form";
import { BrandConfigStep } from "@/components/onboarding/brand-config-step";
import { CompetitorSelectionStep } from "@/components/onboarding/competitor-selection-step";
import { ArticleSettingsStep } from "@/components/onboarding/article-settings-step";
import { LocalizationBrandingStep } from "@/components/onboarding/localization-branding-step";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type OnboardingStep =
  | "url"
  | "analyzing"
  | "brand-config"
  | "competitors"
  | "localization-branding"
  | "article-settings"
  | "complete";

type OnboardingData = {
  websiteUrl: string;
  sitemapUrl?: string;
  exampleArticleUrl?: string;
  competitors: string[];
  companyName: string;
  productDescription: string;
  targetAudience: string;
  toneOfVoice: string;
  keywords: string[];
  includeVideo: boolean;
  includeCitations: boolean;
  includeTables: boolean;
  citationRegion: string;
  brandColor?: string;
  articleStructure: string;
  maxWords: number;
  languageCode: string;
  languageName: string;
};

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
  languageCode: string;
  languageName: string;
};

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { switchProject, refreshProjects } = useProject();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("url");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>(
    {},
  );

  // Steps that user can navigate between (exclude analyzing and complete)
  const navigableSteps: Exclude<OnboardingStep, "analyzing" | "complete">[] = [
    "url",
    "brand-config",
    "competitors",
    "localization-branding",
    "article-settings",
  ];

  // Back navigation: allow going back to previous step but not to "url"
  const canGoBack = (() => {
    if (currentStep === "analyzing" || currentStep === "complete") return false;
    const idx = navigableSteps.findIndex((s) => s === currentStep);
    // Disallow going back when at or before brand-config (index <= 1), since index 0 is url which we don't allow returning to
    return idx > 1;
  })();

  const goBack = () => {
    if (!canGoBack) return;
    const idx = navigableSteps.findIndex((s) => s === currentStep);
    if (idx <= 1) return; // extra safety
    const prev = navigableSteps[idx - 1]!;
    // If prev would be "url", skip it and go to the first allowed step (brand-config)
    const finalStep: OnboardingStep = prev === "url" ? "brand-config" : prev;
    setCurrentStep(finalStep);
  };

  const handleUrlSubmit = async (url: string) => {
    setOnboardingData({ websiteUrl: url });
    setCurrentStep("analyzing");
    // Analyze first to prefill the next steps
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: url }),
      });
      const result = (await response.json()) as {
        success: boolean;
        data?: AnalysisData;
        error?: string;
      };
      if (result.success && result.data) {
        setOnboardingData((prev) => ({
          ...prev,
          companyName: result.data!.companyName,
          productDescription: result.data!.productDescription,
          targetAudience: result.data!.targetAudience,
          toneOfVoice: result.data!.toneOfVoice,
          keywords: result.data!.suggestedKeywords,
          articleStructure: result.data!.contentStrategy.articleStructure,
          maxWords: result.data!.contentStrategy.maxWords,
          languageCode: result.data!.languageCode,
          languageName: result.data!.languageName,
          includeVideo: true,
          includeCitations: true,
          includeTables: true,
          citationRegion: "worldwide",
        }));
      }
    } catch {
      // Ignore analysis failure; user can fill in manually
    } finally {
      setIsLoading(false);
      setCurrentStep("brand-config");
    }
  };

  const handleBrandSubmit = (data: {
    companyName: string;
    productDescription: string;
    targetAudience: string;
    toneOfVoice: string;
    keywords: string[];
  }) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
    setCurrentStep("competitors");
  };

  const handleCompetitorsSubmit = (competitors: string[]) => {
    setOnboardingData((prev) => ({ ...prev, competitors }));
    setCurrentStep("localization-branding");
  };

  const handleArticleSettingsSubmit = (data: {
    includeVideo: boolean;
    includeCitations: boolean;
    includeTables: boolean;
    citationRegion: string;
    brandColor?: string;
  }) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
    void completeOnboarding();
  };

  const handleLocalizationBrandingSubmit = (data: {
    citationRegion: string;
    brandColor?: string;
  languageCode?: string;
  languageName?: string;
  }) => {
  setOnboardingData((prev) => ({ ...prev, ...data }));
    setCurrentStep("article-settings");
  };

  async function completeOnboarding() {
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
            name: `${onboardingData.companyName ?? "Topicowl"} Website`,
            websiteUrl: onboardingData.websiteUrl,
            domain: new URL(onboardingData.websiteUrl!).hostname,
            sitemapUrl: onboardingData.sitemapUrl,
            exampleArticleUrl: onboardingData.exampleArticleUrl,
            excludedDomains: onboardingData.competitors,
            companyName: onboardingData.companyName,
            productDescription: onboardingData.productDescription,
            targetAudience: onboardingData.targetAudience,
            keywords: onboardingData.keywords,
            toneOfVoice: onboardingData.toneOfVoice,
            articleStructure: onboardingData.articleStructure,
            maxWords: onboardingData.maxWords,
            includeVideo: onboardingData.includeVideo,
            includeTables: onboardingData.includeTables,
            includeCitations: onboardingData.includeCitations,
            citationRegion: onboardingData.citationRegion,
            brandColor: onboardingData.brandColor,
            language: onboardingData.languageCode ?? "en",
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
  }

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
    <div className="space-y-6 max-w-2xl mx-auto">
        {/* Back button row */}
        {canGoBack && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="-ml-2"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === "url" && (
          <WebsiteUrlForm onSubmit={handleUrlSubmit} isLoading={isLoading} />
        )}

        {currentStep === "analyzing" && (
          <Card className="text-center">
            <CardContent>
              <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
              <CardTitle className="mb-2 text-2xl md:text-3xl">Analyzing your website</CardTitle>
              <CardDescription>
                Topicowl is analyzing your website to pre-fill the next steps.
              </CardDescription>
            </CardContent>
          </Card>
        )}

        {currentStep === "brand-config" && (
          <BrandConfigStep
            initialData={{
              companyName: onboardingData.companyName ?? "",
              productDescription: onboardingData.productDescription ?? "",
              targetAudience: onboardingData.targetAudience ?? "",
              toneOfVoice: onboardingData.toneOfVoice ?? "",
              keywords: onboardingData.keywords ?? [],
            }}
            onSubmit={handleBrandSubmit}
            isLoading={isLoading}
          />
        )}

        {currentStep === "competitors" && (
          <CompetitorSelectionStep
            initialCompetitors={onboardingData.competitors ?? []}
            onSubmit={handleCompetitorsSubmit}
            isLoading={isLoading}
          />
        )}

        {currentStep === "localization-branding" && (
          <LocalizationBrandingStep
            initialData={{
              citationRegion: onboardingData.citationRegion ?? "worldwide",
              brandColor: onboardingData.brandColor,
              languageCode: onboardingData.languageCode ?? "en",
              languageName: onboardingData.languageName ?? "English",
            }}
            onSubmit={handleLocalizationBrandingSubmit}
            isLoading={isLoading}
          />
        )}

        {currentStep === "article-settings" && (
          <ArticleSettingsStep
            initialData={{
              includeVideo: onboardingData.includeVideo ?? true,
              includeCitations: onboardingData.includeCitations ?? true,
              includeTables: onboardingData.includeTables ?? true,
              citationRegion: onboardingData.citationRegion ?? "worldwide",
              brandColor: onboardingData.brandColor,
            }}
            onSubmit={handleArticleSettingsSubmit}
            isLoading={isLoading}
          />
        )}

        {currentStep === "complete" && (
          <Card className="text-center">
            <CardContent>
              <div className="bg-brand-green/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <svg
                  className="text-brand-green h-8 w-8"
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
              <CardTitle className="mb-2 text-2xl md:text-3xl">All Set!</CardTitle>
              <CardDescription>
                Your project is configured with all the advanced settings.
                Redirecting to the dashboard...
              </CardDescription>
            </CardContent>
          </Card>
        )}
      
    </div>
  );
}
