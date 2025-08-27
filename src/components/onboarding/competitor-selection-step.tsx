"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, TrendingUp, Target } from "lucide-react";

interface CompetitorSelectionStepProps {
  initialCompetitors?: string[];
  onSubmit: (competitors: string[]) => void;
  isLoading?: boolean;
}

export function CompetitorSelectionStep({
  initialCompetitors = [],
  onSubmit,
  isLoading = false,
}: CompetitorSelectionStepProps) {
  const [competitors, setCompetitors] = useState<string[]>(initialCompetitors);
  const [currentInput, setCurrentInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateDomain = (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.([a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
  };

  const normalizeDomain = (input: string): string => {
    let domain = input.toLowerCase().trim();
    
    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, "");
    
    // Remove www. if present
    domain = domain.replace(/^www\./, "");
    
    // Remove trailing slashes and paths
    domain = domain.split("/")[0] ?? domain;
    
    return domain;
  };

  const addCompetitor = () => {
    if (!currentInput.trim()) {
      setError("Please enter a competitor domain");
      return;
    }

    const normalizedDomain = normalizeDomain(currentInput);
    
    if (!validateDomain(normalizedDomain)) {
      setError("Please enter a valid domain (e.g., competitor.com)");
      return;
    }

    if (competitors.includes(normalizedDomain)) {
      setError("This competitor is already added");
      return;
    }

    if (competitors.length >= 10) {
      setError("Maximum 10 competitors allowed");
      return;
    }

    setCompetitors([...competitors, normalizedDomain]);
    setCurrentInput("");
    setError(null);
  };

  const removeCompetitor = (domain: string) => {
    setCompetitors(competitors.filter(c => c !== domain));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCompetitor();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Competitors are optional now; submit whatever is selected (including empty)
    onSubmit(competitors);
  };

  // Submission is always allowed; competitors are optional

  return (
    <Card className="w-full">
    <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
          <Target className="h-5 w-5" />
          Select your competitors
        </CardTitle>
        <p className="text-sm text-muted-foreground">
      Optional, but recommended. Add up to 10 competitor domains.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Box */}
      <Alert className="border-orange-200 bg-orange-50">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
        Choosing competitors helps us find trending topics and content gaps. You can skip this and add them later in project settings.
            </AlertDescription>
          </Alert>

          {/* Competitor Input */}
          <div className="space-y-2">
            <Label htmlFor="competitorInput">Competitor Domain</Label>
            <div className="flex gap-2">
              <Input
                id="competitorInput"
                type="text"
                value={currentInput}
                onChange={(e) => {
                  setCurrentInput(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type competitor domain (e.g. competitor.com)"
                className={error ? "border-red-500" : ""}
                disabled={isLoading}
              />
              <Button
                type="button"
                onClick={addCompetitor}
                disabled={isLoading || competitors.length >= 10}
                size="icon"
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {competitors.length}/10 competitors added
            </p>
          </div>

          {/* Selected Competitors */}
          {competitors.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Competitors</Label>
              <div className="flex flex-wrap gap-2">
                {competitors.map((competitor) => (
                  <Badge
                    key={competitor}
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    <span className="flex items-center gap-2">
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
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCompetitor(competitor)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Submit / Skip */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSubmit([])}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Skip for now
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
