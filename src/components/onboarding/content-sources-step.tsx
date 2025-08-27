"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, Globe } from "lucide-react";

interface ContentSourcesStepProps {
  websiteUrl: string;
  initialSitemapUrl?: string;
  initialExampleArticleUrl?: string;
  onSubmit: (data: { sitemapUrl?: string; exampleArticleUrl?: string }) => void;
  isLoading?: boolean;
}

export function ContentSourcesStep({
  websiteUrl,
  initialSitemapUrl = "",
  initialExampleArticleUrl = "",
  onSubmit,
  isLoading = false,
}: ContentSourcesStepProps) {
  const [sitemapUrl, setSitemapUrl] = useState(initialSitemapUrl);
  const [exampleArticleUrl, setExampleArticleUrl] = useState(initialExampleArticleUrl);
  const [errors, setErrors] = useState<{ sitemap?: string; article?: string }>({});
  const [isDetecting, setIsDetecting] = useState(false);

  const getDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  };

  const domain = getDomainFromUrl(websiteUrl);

  const validateUrls = (): boolean => {
    const newErrors: { sitemap?: string; article?: string } = {};

    // Validate sitemap URL if provided
    if (sitemapUrl?.trim()) {
      try {
        const sitemapDomain = new URL(sitemapUrl).hostname;
        if (sitemapDomain !== domain) {
          newErrors.sitemap = "Sitemap URL must be from the same domain";
        }
      } catch {
        newErrors.sitemap = "Please enter a valid sitemap URL";
      }
    }

    // Validate example article URL if provided
    if (exampleArticleUrl?.trim()) {
      try {
        const articleDomain = new URL(exampleArticleUrl).hostname;
        if (articleDomain !== domain) {
          newErrors.article = "Example article must be from the same domain";
        }
      } catch {
        newErrors.article = "Please enter a valid article URL";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAutoDetectSitemap = async () => {
    setIsDetecting(true);
    const commonSitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/sitemaps.xml"];
    
    for (const path of commonSitemapPaths) {
      try {
        const testUrl = `${websiteUrl.replace(/\/$/, "")}${path}`;
        const response = await fetch(`/api/onboarding/validate-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: testUrl }),
        });
        
        if (response.ok) {
          setSitemapUrl(testUrl);
          break;
        }
      } catch {
        // Continue to next path
      }
    }
    setIsDetecting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUrls()) return;

    onSubmit({
      sitemapUrl: sitemapUrl.trim() || undefined,
      exampleArticleUrl: exampleArticleUrl.trim() || undefined,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Content Sources</CardTitle>
        <p className="text-sm text-muted-foreground">
          Help us discover more about your content by providing additional sources for analysis.
          Both fields are optional, but they&apos;ll help us create better content.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sitemap URL Section */}
          <div className="space-y-2">
            <Label htmlFor="sitemapUrl" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Sitemap URL (optional)
            </Label>
            <p className="text-sm text-muted-foreground">
              Help us discover all your content pages for better analysis
            </p>
            <div className="flex gap-2">
              <Input
                id="sitemapUrl"
                type="url"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                className={errors.sitemap ? "border-red-500" : ""}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAutoDetectSitemap}
                disabled={isDetecting || isLoading}
                className="whitespace-nowrap"
              >
                {isDetecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Auto-detect"
                )}
              </Button>
            </div>
            {errors.sitemap && (
              <p className="text-sm text-red-600">{errors.sitemap}</p>
            )}
          </div>

          {/* Example Article URL Section */}
          <div className="space-y-2">
            <Label htmlFor="exampleArticleUrl" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Your Best Article (optional)
            </Label>
            <p className="text-sm text-muted-foreground">
              Share an article that represents your ideal writing style and structure
            </p>
            <Input
              id="exampleArticleUrl"
              type="url"
              value={exampleArticleUrl}
              onChange={(e) => setExampleArticleUrl(e.target.value)}
              placeholder="https://example.com/blog/your-best-article"
              className={errors.article ? "border-red-500" : ""}
            />
            {errors.article && (
              <p className="text-sm text-red-600">{errors.article}</p>
            )}
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertDescription>
              <strong>Why do we need this?</strong>
              <br />
              • <strong>Sitemap:</strong> Helps us analyze your content patterns and structure
              <br />
              • <strong>Example Article:</strong> Lets us learn your writing style, tone, and preferred format
            </AlertDescription>
          </Alert>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onSubmit({})}
              disabled={isLoading}
            >
              Skip This Step
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
