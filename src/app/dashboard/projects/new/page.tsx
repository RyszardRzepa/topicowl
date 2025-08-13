"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useProject } from "@/contexts/project-context";

interface AnalysisData {
  domain: string;
  companyName?: string;
  productDescription?: string;
  toneOfVoice?: string;
  suggestedKeywords?: string[];
  industryCategory?: string;
  targetAudience?: string;
  contentStrategy?: {
    articleStructure?: string;
    maxWords?: number;
    publishingFrequency?: string;
  };
}

interface CreateState {
  websiteUrl: string;
  name: string; // optional project name override
}

export default function NewProjectPage() {
  const router = useRouter();
  const { refreshProjects, switchProject } = useProject();
  const [createState, setCreateState] = useState<CreateState>({
    websiteUrl: "https://",
    name: "",
  });
  // analysis data not displayed anymore; kept only transiently inside submit flow
  const [phase, setPhase] = useState<"idle" | "analyzing" | "creating">("idle");
  const [error, setError] = useState("");
  const [domainInput, setDomainInput] = useState(""); // user editable part after https://
  

  // Single flow: analyze then create
  const handleSubmit = async () => {
    setError("");
    if (!createState.name.trim()) { setError("Project name is required"); return; }
    const sanitized = sanitizeDomainInput(domainInput);
    if (!sanitized) { setError("Domain required"); return; }
    if (!isValidDomain(sanitized)) { setError("Please enter a valid domain (e.g., example.com)"); return; }
    const fullUrl = `https://${sanitized}`;
    setCreateState(s => ({ ...s, websiteUrl: fullUrl }));

    setPhase("analyzing");
  let localAnalysis: AnalysisData | null = null;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", websiteUrl: fullUrl }),
      });
      const data = await res.json() as { success?: boolean; data?: AnalysisData; error?: string };
      if (!res.ok || !data.success || !data.data) throw new Error(data.error ?? "Analysis failed");
  localAnalysis = data.data;
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Analysis failed");
      return;
    }

    setPhase("creating");
    try {
      const payload: Record<string, unknown> = {
        websiteUrl: fullUrl,
        analysisData: localAnalysis,
        useAnalyzedName: true,
        name: createState.name.trim(),
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { success?: boolean; data?: { id: number }; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Failed to create project");
      await refreshProjects();
      if (data.data?.id) await switchProject(data.data.id);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setPhase("idle");
    }
  };

  // Removed manual keyword management (no longer asking for these fields)

  function sanitizeDomainInput(value: string): string {
    let v = value.trim();
    if (!v) return "";
    // Remove protocol if user pasted it
    v = v.replace(/^https?:\/\//i, "");
    // Remove any accidental leading slashes
    v = v.replace(/^\/+/, "");
    return v;
  }

  function isValidDomain(domain: string): boolean {
    if (!domain) return false;
    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.includes('.') && domain.length <= 253;
  }

  return (
  <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 p-0 h-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Create New Project</h1>
            <p className="text-muted-foreground">
              Set up a new project to start generating content
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Creation</CardTitle>
          <CardDescription>Enter your website URL. We&apos;ll analyze it and auto-populate project data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              value={createState.name}
              onChange={(e) => setCreateState(s => ({ ...s, name: e.target.value }))}
              placeholder="My Project"
              required
              disabled={phase !== "idle"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Website URL *</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring overflow-hidden">
              <span className="pl-3 text-sm text-muted-foreground select-none">https://</span>
              <input
                id="domain"
                type="text"
                className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
                placeholder="example.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
        disabled={phase !== "idle"}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Enter domain only (no protocol). We fetch and analyze public content (≤30s).</p>
          </div>
      {/* Preview removed for single-click flow */}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={phase !== "idle"}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={phase !== "idle" || !createState.name.trim() || !isValidDomain(sanitizeDomainInput(domainInput))}>
              {phase !== "idle" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {phase === "analyzing" ? "Analyzing..." : phase === "creating" ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
