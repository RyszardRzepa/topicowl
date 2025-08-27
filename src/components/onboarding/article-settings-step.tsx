"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Settings } from "lucide-react";

interface ArticleSettingsStepProps {
  initialData?: {
    includeVideo: boolean;
    includeCitations: boolean;
    includeTables: boolean;
  citationRegion: string;
  brandColor?: string;
  };
  onSubmit: (data: {
    includeVideo: boolean;
    includeCitations: boolean;
    includeTables: boolean;
  citationRegion: string;
  brandColor?: string;
  }) => void;
  isLoading?: boolean;
}

// Note: Localization & Branding moved to a dedicated step

export function ArticleSettingsStep({
  initialData,
  onSubmit,
  isLoading = false,
}: ArticleSettingsStepProps) {
  const [includeVideo, setIncludeVideo] = useState(initialData?.includeVideo ?? true);
  const [includeCitations, setIncludeCitations] = useState(initialData?.includeCitations ?? true);
  const [includeTables, setIncludeTables] = useState(initialData?.includeTables ?? true);
  const [citationRegion] = useState(initialData?.citationRegion ?? "worldwide");
  const [brandColor] = useState(initialData?.brandColor ?? "#000000");
  const [includeSchema, setIncludeSchema] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      includeVideo,
      includeCitations,
      includeTables,
      citationRegion,
      brandColor: brandColor !== "#000000" ? brandColor : undefined,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
          <Settings className="h-5 w-5" />
          Article Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure the article settings for your website.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Content Features */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content Features
            </h3>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="includeVideo">Include YouTube Video</Label>
                  <p className="text-sm text-muted-foreground">
                    Embed relevant YouTube videos in articles
                  </p>
                </div>
                <Switch
                  id="includeVideo"
                  checked={includeVideo}
                  onCheckedChange={setIncludeVideo}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="includeCitations">Include Citations</Label>
                  <p className="text-sm text-muted-foreground">
                    Add source citations to articles
                  </p>
                </div>
                <Switch
                  id="includeCitations"
                  checked={includeCitations}
                  onCheckedChange={setIncludeCitations}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="includeTables">Include Tables</Label>
                  <p className="text-sm text-muted-foreground">
                    Add data tables when relevant
                  </p>
                </div>
                <Switch
                  id="includeTables"
                  checked={includeTables}
                  onCheckedChange={setIncludeTables}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="includeSchema">Include JSON-LD Schema</Label>
                  <p className="text-sm text-muted-foreground">
                    Add structured data for better SEO
                  </p>
                </div>
                <Switch
                  id="includeSchema"
      checked={includeSchema}
      onCheckedChange={setIncludeSchema}
      disabled={isLoading}
                />
              </div>
            </div>
          </div>

    {/* Note: Localization & Branding moved to its own step */}

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finish Setup
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
