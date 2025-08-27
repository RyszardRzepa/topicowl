"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Globe, Target, Building, FileText, CheckCircle } from "lucide-react";

interface OnboardingData {
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
}

interface ReviewStepProps {
  data: OnboardingData;
  onSubmit: () => void;
  onEdit: (step: string) => void;
  isLoading?: boolean;
}

const Separator = ({ className = "" }: { className?: string }) => (
  <hr className={`border-t border-border ${className}`} />
);

export function ReviewStep({
  data,
  onSubmit,
  onEdit,
  isLoading = false,
}: ReviewStepProps) {
  const formatToneOfVoice = (tone: string) => {
    return tone.charAt(0).toUpperCase() + tone.slice(1);
  };

  const formatArticleStructure = (structure: string) => {
    const formats: Record<string, string> = {
      "how-to": "How-to Guide",
      "listicle": "Listicle",
      "comparison": "Comparison",
      "educational": "Educational",
      "news": "News Style",
      "custom": "Custom",
    };
    return formats[structure] ?? structure;
  };

  const formatCitationRegion = (region: string) => {
    const regions: Record<string, string> = {
      "worldwide": "Worldwide",
      "us": "United States",
      "uk": "United Kingdom",
      "eu": "European Union",
      "ca": "Canada",
      "au": "Australia",
    };
    return regions[region] ?? region;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Review Your Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Review all settings before completing the setup. You can edit any section if needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Website Information */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website & Content Sources
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit("configure")}
              disabled={isLoading}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <div className="grid gap-2 text-sm">
            <div><strong>Website URL:</strong> {data.websiteUrl}</div>
            {data.sitemapUrl && <div><strong>Sitemap URL:</strong> {data.sitemapUrl}</div>}
            {data.exampleArticleUrl && <div><strong>Example Article:</strong> {data.exampleArticleUrl}</div>}
          </div>
        </div>

        <Separator />

        {/* Competitors */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Competitors ({data.competitors.length})
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit("configure")}
              disabled={isLoading}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.competitors.map((competitor) => (
              <Badge key={competitor} variant="secondary" className="flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${competitor}&sz=16`}
                  alt=""
                  className="h-4 w-4"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                {competitor}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Brand & Voice */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Building className="h-4 w-4" />
              Brand & Voice
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit("configure")}
              disabled={isLoading}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div><strong>Company:</strong> {data.companyName}</div>
            <div><strong>Tone of Voice:</strong> {formatToneOfVoice(data.toneOfVoice)}</div>
            <div className="md:col-span-2">
              <strong>Product Description:</strong> 
              <p className="mt-1 text-muted-foreground">{data.productDescription}</p>
            </div>
            <div className="md:col-span-2">
              <strong>Target Audience:</strong> 
              <p className="mt-1 text-muted-foreground">{data.targetAudience}</p>
            </div>
            {data.keywords.length > 0 && (
              <div className="md:col-span-2">
                <strong>Keywords:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.keywords.map((keyword) => (
                    <Badge key={keyword} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Article Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Article Settings
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit("configure")}
              disabled={isLoading}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div><strong>Article Structure:</strong> {formatArticleStructure(data.articleStructure)}</div>
            <div><strong>Max Word Count:</strong> {data.maxWords}</div>
            <div><strong>Citation Region:</strong> {formatCitationRegion(data.citationRegion)}</div>
            {data.brandColor && (
              <div className="flex items-center gap-2">
                <strong>Brand Color:</strong>
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: data.brandColor }}
                />
                <span className="font-mono text-xs">{data.brandColor}</span>
              </div>
            )}
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div><strong>Include YouTube Videos:</strong> {data.includeVideo ? "Yes" : "No"}</div>
            <div><strong>Include Citations:</strong> {data.includeCitations ? "Yes" : "No"}</div>
            <div><strong>Include Tables:</strong> {data.includeTables ? "Yes" : "No"}</div>
            <div><strong>Include JSON-LD Schema:</strong> Yes</div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-6">
          <Button 
            onClick={onSubmit}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Setup & Create Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
