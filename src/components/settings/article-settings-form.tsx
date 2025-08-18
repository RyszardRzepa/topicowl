"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReusableTabs } from "@/components/ui/reusable-tabs";
import { ExcludedDomainsField } from "./excluded-domains-field";
import { useProject } from "@/contexts/project-context";
import type {
  ProjectSettingsRequest,
  ProjectSettingsResponse,
} from "@/app/api/settings/route";
import type { FetchSitemapResponse } from "@/app/api/sitemaps/fetch/route";
import { prompts } from "@/prompts";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

// Form-specific type for component state
interface ArticleSettingsForm {
  // Article generation settings
  toneOfVoice: string;
  articleStructure: string;
  maxWords: number;
  excluded_domains: string[];
  sitemap_url: string;
  includeVideo: boolean;
  includeTables: boolean;
  // Company/business settings
  companyName: string;
  productDescription: string;
  keywords: string[];
  industryCategory: string;
  targetAudience: string;
  publishingFrequency: string;
}

interface ArticleSettingsFormProps {
  initialSettings: ProjectSettingsResponse;
  onSettingsUpdate: (settings: ProjectSettingsResponse) => void;
}

export function ArticleSettingsForm({
  initialSettings,
  onSettingsUpdate,
}: ArticleSettingsFormProps) {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState("company");
  const [formData, setFormData] = useState<ArticleSettingsForm>({
    // Article generation settings
    toneOfVoice:
      initialSettings.toneOfVoice ??
      "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
    articleStructure:
      initialSettings.articleStructure ?? prompts.articleStructure(),
    maxWords: initialSettings.maxWords ?? 800,
    excluded_domains: initialSettings.excludedDomains ?? [],
    sitemap_url: initialSettings.sitemapUrl ?? "",
    includeVideo: initialSettings.includeVideo ?? true,
    includeTables: initialSettings.includeTables ?? true,
    // Company/business settings
    companyName: initialSettings.companyName ?? "",
    productDescription: initialSettings.productDescription ?? "",
    keywords: initialSettings.keywords ?? [],
    // Set default values for properties not in API
    industryCategory: "business",
    targetAudience: "",
    publishingFrequency: "weekly",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testingSitemap, setTestingSitemap] = useState(false);
  const [sitemapTestResult, setSitemapTestResult] = useState<string | null>(
    null,
  );

  const handleInputChange = (
    field: keyof ArticleSettingsForm,
    value: string | number | string[] | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleKeywordsChange = (keywordsString: string) => {
    const keywordsArray = keywordsString
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    handleInputChange("keywords", keywordsArray);
  };

  const handleSave = async () => {
    if (!currentProject) {
      setSaveMessage("Please select a project first");
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    try {
      setSaving(true);
      setSaveMessage(null);
      setIsLoading(true);

      // Create request payload with project context
      const requestData: ProjectSettingsRequest = {
        projectId: currentProject.id,
        // Article generation settings
        toneOfVoice: formData.toneOfVoice,
        articleStructure: formData.articleStructure,
        maxWords: formData.maxWords,
        excludedDomains: formData.excluded_domains,
        sitemapUrl: formData.sitemap_url || undefined,
        includeVideo: formData.includeVideo,
        includeTables: formData.includeTables,
        // Company/business settings
        companyName: formData.companyName || undefined,
        productDescription: formData.productDescription || undefined,
        keywords: formData.keywords,
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to save settings" }))) as {
          error?: string;
          details?: string[];
        };

        // Handle domain validation errors specifically
        if (errorData.details && Array.isArray(errorData.details)) {
          throw new Error(`Invalid domains: ${errorData.details.join(", ")}`);
        }

        throw new Error(errorData.error ?? "Failed to save settings");
      }

      const updatedSettings =
        (await response.json()) as ProjectSettingsResponse;
      onSettingsUpdate(updatedSettings);
      setSaveMessage(
        "Settings saved successfully! Your excluded domains will be applied to future article generation.",
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to save settings",
      );

      // Clear error message after 8 seconds
      setTimeout(() => setSaveMessage(null), 8000);
    } finally {
      setSaving(false);
      setIsLoading(false);
    }
  };

  const handleTestSitemap = async () => {
    if (!formData.sitemap_url) {
      setSitemapTestResult("Please enter a sitemap URL first");
      setTimeout(() => setSitemapTestResult(null), 5000);
      return;
    }

    try {
      setTestingSitemap(true);
      setSitemapTestResult(null);

      const response = await fetch("/api/sitemaps/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl: formData.sitemap_url.replace("/sitemap.xml", ""),
          refreshCache: true,
        }),
      });

      const result = (await response.json()) as FetchSitemapResponse;

      if (result.success && result.data) {
        setSitemapTestResult(
          `✓ Sitemap is valid! Found ${result.data.totalBlogPosts} blog posts.`,
        );
      } else {
        setSitemapTestResult(
          `✗ Sitemap test failed: ${result.error ?? "Unknown error"}`,
        );
      }

      // Clear result message after 10 seconds
      setTimeout(() => setSitemapTestResult(null), 10000);
    } catch (error) {
      console.error("Failed to test sitemap:", error);
      setSitemapTestResult(
        `✗ Failed to test sitemap: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      // Clear error message after 10 seconds
      setTimeout(() => setSitemapTestResult(null), 10000);
    } finally {
      setTestingSitemap(false);
    }
  };

  const handleReset = async () => {
    if (!currentProject) {
      setSaveMessage("Please select a project first");
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    try {
      setSaving(true);
      setSaveMessage(null);
      setIsLoading(true);

      // Reset to default settings
      const defaultSettings: ProjectSettingsRequest = {
        projectId: currentProject.id,
        toneOfVoice:
          "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
        articleStructure: prompts.articleStructure(),
        maxWords: 800,
        excludedDomains: [],
        sitemapUrl: "",
        includeVideo: true,
        includeTables: true,
        companyName: "",
        productDescription: "",
        keywords: [],
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(defaultSettings),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to reset settings" }))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to reset settings");
      }

      const settings = (await response.json()) as ProjectSettingsResponse;
      setFormData({
        toneOfVoice: settings.toneOfVoice ?? "professional",
        articleStructure:
          settings.articleStructure ?? prompts.articleStructure(),
        maxWords: settings.maxWords ?? 800,
        excluded_domains: settings.excludedDomains ?? [],
        sitemap_url: settings.sitemapUrl ?? "",
        includeVideo: settings.includeVideo ?? true,
        includeTables: settings.includeTables ?? true,
        companyName: settings.companyName ?? "",
        productDescription: settings.productDescription ?? "",
        keywords: settings.keywords ?? [],
        // Default values for properties not in API
        industryCategory: "business",
        targetAudience: "",
        publishingFrequency: "weekly",
      });
      onSettingsUpdate(settings);
      setSaveMessage(
        "Settings reset to defaults! All excluded domains have been cleared.",
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error("Failed to reset settings:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to reset settings",
      );

      // Clear error message after 8 seconds
      setTimeout(() => setSaveMessage(null), 8000);
    } finally {
      setSaving(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReusableTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          {
            value: "company",
            label: "Company",
          },
          {
            value: "seo",
            label: "SEO & Content",
          },
          {
            value: "generation",
            label: "Article Generation",
          },
        ]}
        className="mb-0"
      />

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="company" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Company & Brand Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Name */}
              <div>
                <label
                  htmlFor="companyName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Company Name
                </label>
                <Input
                  type="text"
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) =>
                    handleInputChange("companyName", e.target.value)
                  }
                  placeholder="Your company name"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Your company or brand name for article attribution
                </p>
              </div>

              {/* Product Description */}
              <div>
                <label
                  htmlFor="productDescription"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Product/Service Description
                </label>
                <Textarea
                  id="productDescription"
                  rows={3}
                  value={formData.productDescription}
                  onChange={(e) =>
                    handleInputChange("productDescription", e.target.value)
                  }
                  placeholder="Describe what your company does..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Brief description of your products or services for context
                </p>
              </div>

              {/* Keywords */}
              <div>
                <label
                  htmlFor="keywords"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Target Keywords
                </label>
                <Input
                  type="text"
                  id="keywords"
                  value={formData.keywords.join(", ")}
                  onChange={(e) => handleKeywordsChange(e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Comma-separated list of keywords to focus on in articles
                </p>
              </div>

              {/* Industry Category */}
              <div>
                <label
                  htmlFor="industryCategory"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Industry Category
                </label>
                <Select
                  value={formData.industryCategory}
                  onValueChange={(value) =>
                    handleInputChange("industryCategory", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select industry category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                    <SelectItem value="food-beverage">Food & Beverage</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="fitness">Fitness</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="non-profit">Non-Profit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-sm text-gray-500">
                  Your industry for content strategy optimization
                </p>
              </div>

              {/* Target Audience */}
              <div>
                <label
                  htmlFor="targetAudience"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Target Audience
                </label>
                <Input
                  type="text"
                  id="targetAudience"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    handleInputChange("targetAudience", e.target.value)
                  }
                  placeholder="e.g., business professionals, small business owners"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Who your articles are primarily written for
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO & Sitemap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="sitemapUrl"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Sitemap URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    id="sitemapUrl"
                    value={formData.sitemap_url}
                    onChange={(e) =>
                      handleInputChange("sitemap_url", e.target.value)
                    }
                    placeholder="https://yourwebsite.com/sitemap.xml"
                  />
                  <Button
                    type="button"
                    onClick={handleTestSitemap}
                    disabled={testingSitemap || !formData.sitemap_url}
                    variant="outline"
                    className="flex items-center gap-2 px-4"
                  >
                    {testingSitemap && (
                      <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {testingSitemap ? "Testing..." : "Test Sitemap"}
                  </Button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  URL to your website&apos;s sitemap for better internal
                  linking. We&apos;ll automatically detect blog posts from your
                  sitemap.
                </p>

                {/* Sitemap Test Result */}
                {sitemapTestResult && (
                  <div
                    className={`mt-3 flex items-start gap-3 rounded-lg p-3 ${
                      sitemapTestResult.startsWith("✓")
                        ? "border border-green-200 bg-green-50 text-green-800"
                        : "border border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {sitemapTestResult.startsWith("✓") ? (
                        <svg
                          className="h-4 w-4 text-green-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{sitemapTestResult}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Excluded Domains */}
              <ExcludedDomainsField
                domains={formData.excluded_domains}
                onChange={(domains) =>
                  handleInputChange("excluded_domains", domains)
                }
                disabled={saving || isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Article Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tone of Voice */}
              <div>
                <label
                  htmlFor="toneOfVoice"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Tone of Voice
                </label>
                <Textarea
                  id="toneOfVoice"
                  rows={5}
                  value={formData.toneOfVoice}
                  onChange={(e) =>
                    handleInputChange("toneOfVoice", e.target.value)
                  }
                />
                <p className="mt-1 text-sm text-gray-500">
                  Describe the writing style, personality, and voice you want
                  for your articles. Be as specific as possible to help the AI
                  understand your brands communication style.
                </p>
              </div>

              {/* Article Structure */}
              <div>
                <label
                  htmlFor="articleStructure"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Article Structure
                </label>
                <Textarea
                  id="articleStructure"
                  rows={6}
                  value={formData.articleStructure}
                  onChange={(e) =>
                    handleInputChange("articleStructure", e.target.value)
                  }
                  placeholder="e.g., Introduction • Main points • Conclusion"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The overall structure and flow template for your articles
                </p>
              </div>

              {/* Max Words */}
              <div>
                <label
                  htmlFor="maxWords"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Maximum Words
                </label>
                <Input
                  type="number"
                  id="maxWords"
                  value={formData.maxWords}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 800;
                    handleInputChange("maxWords", value);
                  }}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Target word count for generated articles. Must be between 100
                  and 5,000 words.
                </p>
              </div>

              {/* Content Section Preferences */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Content Sections
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor="includeVideo"
                        className="text-sm font-medium text-gray-700"
                      >
                        Include video sections
                      </label>
                      <p className="mt-1 text-sm text-gray-500">
                        Add relevant video embeds to articles when available
                      </p>
                    </div>
                    <Switch
                      id="includeVideo"
                      checked={formData.includeVideo}
                      onCheckedChange={(checked) =>
                        handleInputChange("includeVideo", checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor="includeTables"
                        className="text-sm font-medium text-gray-700"
                      >
                        Include table sections
                      </label>
                      <p className="mt-1 text-sm text-gray-500">
                        Add data tables and comparison charts when relevant
                      </p>
                    </div>
                    <Switch
                      id="includeTables"
                      checked={formData.includeTables}
                      onCheckedChange={(checked) =>
                        handleInputChange("includeTables", checked)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`flex items-start gap-3 rounded-lg p-4 ${
            saveMessage.includes("successfully") ||
            saveMessage.includes("reset")
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="mt-0.5 flex-shrink-0">
            {saveMessage.includes("successfully") ||
            saveMessage.includes("reset") ? (
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {saveMessage.includes("successfully") ||
              saveMessage.includes("reset")
                ? "Success"
                : "Error"}
            </p>
            <p className="mt-1 text-sm">{saveMessage}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button
          onClick={handleSave}
          disabled={saving || isLoading}
        >
          {saving && (
            <svg
              className="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {saving ? "Saving Changes..." : "Save Changes"}
        </Button>
        
      </div>
    </div>
  );
}
