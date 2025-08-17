"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputWithPrefix } from "@/components/ui/input-with-prefix";
import { Label } from "@/components/ui/label";

interface WebsiteUrlFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

export function WebsiteUrlForm({ onSubmit, isLoading }: WebsiteUrlFormProps) {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic domain validation
    if (!domain.trim()) {
      setError("Please enter your website domain");
      return;
    }

    // Clean the domain input (remove any protocol, www, trailing slashes)
    const cleanDomain = domain.trim()
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/^www\./, '') // Remove www
      .replace(/\/$/, ''); // Remove trailing slash

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(cleanDomain)) {
      setError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    const fullUrl = `https://${cleanDomain}`;
    await onSubmit(fullUrl);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          Enter your website domain
        </CardTitle>
        <CardDescription>
          We&apos;ll analyze your website to create personalized content settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain" className="pb-2">
              Website Domain
            </Label>
            <InputWithPrefix
              id="domain"
              name="domain"
              type="text"
              placeholder="example.com"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
              disabled={isLoading}
              required
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !domain.trim()}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Analyzing..." : "Analyze Website"}
          </Button>
        </form>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            Don&apos;t have a website? You can set up your content preferences manually later.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
