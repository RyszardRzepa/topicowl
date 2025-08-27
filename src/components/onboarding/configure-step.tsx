"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings2, Building, Users, Plus, X, Globe, Target, FileText } from "lucide-react";

type ConfigureInitial = {
  // Website basics
  websiteUrl: string;
  sitemapUrl?: string;
  exampleArticleUrl?: string;
  competitors?: string[];
  // Brand
  companyName?: string;
  productDescription?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  keywords?: string[];
  // Article settings
  includeVideo?: boolean;
  includeCitations?: boolean;
  includeTables?: boolean;
  citationRegion?: string;
  brandColor?: string;
  articleStructure?: string;
  maxWords?: number;
};

interface ConfigureStepProps {
  initial?: ConfigureInitial;
  onSubmit: (data: {
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
  }) => void;
  isLoading?: boolean;
}

const toneOptions = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "educational", label: "Educational" },
  { value: "friendly", label: "Friendly" },
  { value: "authoritative", label: "Authoritative" },
  { value: "inspirational", label: "Inspirational" },
];

const citationRegionOptions = [
  { value: "worldwide", label: "Worldwide" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
];

const articleStructureOptions = [
  { value: "how-to", label: "How-to Guide" },
  { value: "listicle", label: "Listicle" },
  { value: "comparison", label: "Comparison" },
  { value: "educational", label: "Educational" },
  { value: "news", label: "News Style" },
  { value: "custom", label: "Custom" },
];

export function ConfigureStep({ initial, onSubmit, isLoading = false }: ConfigureStepProps) {
  // Website
  const [sitemapUrl, setSitemapUrl] = useState(initial?.sitemapUrl ?? "");
  const [exampleArticleUrl, setExampleArticleUrl] = useState(initial?.exampleArticleUrl ?? "");
  const [competitors, setCompetitors] = useState<string[]>(initial?.competitors ?? []);
  const [competitorInput, setCompetitorInput] = useState("");

  // Brand
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [productDescription, setProductDescription] = useState(initial?.productDescription ?? "");
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience ?? "");
  const [toneOfVoice, setToneOfVoice] = useState(initial?.toneOfVoice ?? "");
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");

  // Articles
  const [includeVideo, setIncludeVideo] = useState(initial?.includeVideo ?? true);
  const [includeCitations, setIncludeCitations] = useState(initial?.includeCitations ?? true);
  const [includeTables, setIncludeTables] = useState(initial?.includeTables ?? true);
  const [citationRegion, setCitationRegion] = useState(initial?.citationRegion ?? "worldwide");
  const [brandColor, setBrandColor] = useState(initial?.brandColor ?? "#ff6a00");
  const [articleStructure, setArticleStructure] = useState(initial?.articleStructure ?? "educational");
  const [maxWords, setMaxWords] = useState(initial?.maxWords ?? 1000);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const normalizedCompetitor = (value: string) => {
    try {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const url = trimmed.includes("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };

  const addCompetitor = () => {
    const dom = normalizedCompetitor(competitorInput);
    if (!dom) return;
    if (!competitors.includes(dom) && competitors.length < 10) {
      setCompetitors([...competitors, dom]);
      setCompetitorInput("");
    }
  };

  const removeCompetitor = (dom: string) => setCompetitors(competitors.filter((c) => c !== dom));

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };
  const removeKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Company name is required";
    if (!productDescription.trim()) e.productDescription = "Product description is required";
    if (!targetAudience.trim()) e.targetAudience = "Target audience is required";
    if (!toneOfVoice) e.toneOfVoice = "Tone of voice is required";
    if (maxWords < 500 || maxWords > 2500) e.maxWords = "Word count must be 500-2500";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      websiteUrl: initial?.websiteUrl ?? "",
      sitemapUrl: sitemapUrl || undefined,
      exampleArticleUrl: exampleArticleUrl || undefined,
      competitors,
      companyName: companyName.trim(),
      productDescription: productDescription.trim(),
      targetAudience: targetAudience.trim(),
      toneOfVoice,
      keywords,
      includeVideo,
      includeCitations,
      includeTables,
      citationRegion,
      brandColor,
      articleStructure,
      maxWords,
    });
  };

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" /> Configure your project
        </CardTitle>
        <p className="text-sm text-muted-foreground">Only the essentials, with optional advanced sections.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Brand essentials */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2"><Building className="h-4 w-4"/>Company name *</Label>
              <Input id="companyName" value={companyName} onChange={(e)=>{setCompanyName(e.target.value); if(errors.companyName) setErrors({...errors, companyName: ""});}} disabled={isLoading} placeholder="Your company" className={errors.companyName?"border-red-500":""} />
              {errors.companyName && <p className="text-sm text-red-600">{errors.companyName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="toneOfVoice">Tone of voice *</Label>
              <Select value={toneOfVoice} onValueChange={(v)=>{setToneOfVoice(v); if(errors.toneOfVoice) setErrors({...errors, toneOfVoice: ""});}} disabled={isLoading}>
                <SelectTrigger className={errors.toneOfVoice?"border-red-500":""}><SelectValue placeholder="Select tone"/></SelectTrigger>
                <SelectContent>
                  {toneOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.toneOfVoice && <p className="text-sm text-red-600">{errors.toneOfVoice}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="productDescription">Product/Service description *</Label>
              <Textarea id="productDescription" value={productDescription} onChange={(e)=>{setProductDescription(e.target.value); if(errors.productDescription) setErrors({...errors, productDescription: ""});}} rows={3} placeholder="What do you offer?" disabled={isLoading} className={errors.productDescription?"border-red-500":""} />
              {errors.productDescription && <p className="text-sm text-red-600">{errors.productDescription}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="targetAudience" className="flex items-center gap-2"><Users className="h-4 w-4"/>Target audience *</Label>
              <Textarea id="targetAudience" value={targetAudience} onChange={(e)=>{setTargetAudience(e.target.value); if(errors.targetAudience) setErrors({...errors, targetAudience: ""});}} rows={3} placeholder="Who are you writing for?" disabled={isLoading} className={errors.targetAudience?"border-red-500":""} />
              {errors.targetAudience && <p className="text-sm text-red-600">{errors.targetAudience}</p>}
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label>Primary keywords</Label>
            <div className="flex gap-2">
              <Input value={keywordInput} onChange={(e)=>setKeywordInput(e.target.value)} onKeyDown={(e)=>{ if(e.key === "Enter"){ e.preventDefault(); addKeyword(); } }} placeholder="Add keyword and press Enter" disabled={isLoading} />
              <Button type="button" variant="outline" size="icon" onClick={addKeyword} disabled={isLoading || !keywordInput.trim()}><Plus className="h-4 w-4"/></Button>
            </div>
            {keywords.length>0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map(k => (
                  <Badge key={k} variant="secondary" className="flex items-center gap-1">
                    {k}
                    <button type="button" onClick={()=>removeKeyword(k)} className="ml-1 text-muted-foreground hover:text-destructive" disabled={isLoading}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Article settings */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Include YouTube videos</Label>
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-sm text-muted-foreground">Embed relevant videos in articles</span>
                <Switch checked={includeVideo} onCheckedChange={setIncludeVideo} disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Include citations</Label>
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-sm text-muted-foreground">Add source citations to articles</span>
                <Switch checked={includeCitations} onCheckedChange={setIncludeCitations} disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Include tables</Label>
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-sm text-muted-foreground">Add data tables when relevant</span>
                <Switch checked={includeTables} onCheckedChange={setIncludeTables} disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Citation region</Label>
              <Select value={citationRegion} onValueChange={setCitationRegion} disabled={isLoading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {citationRegionOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brandColor} onChange={(e)=>setBrandColor(e.target.value)} className="h-10 w-16 rounded border border-input bg-background" disabled={isLoading} />
                <span className="text-xs font-mono">{brandColor}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Article template</Label>
              <Select value={articleStructure} onValueChange={setArticleStructure} disabled={isLoading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {articleStructureOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Maximum word count</Label>
              <Input type="number" value={maxWords} onChange={(e)=>setMaxWords(Number(e.target.value))} min={500} max={2500} step={50} disabled={isLoading} />
              {errors.maxWords && <p className="text-sm text-red-600">{errors.maxWords}</p>}
            </div>
          </div>

          {/* Advanced optional: sources and competitors */}
          <SimpleAdvanced>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sitemapUrl" className="flex items-center gap-2"><Globe className="h-4 w-4"/>Sitemap URL</Label>
                  <Input id="sitemapUrl" value={sitemapUrl} onChange={(e)=>setSitemapUrl(e.target.value)} placeholder="https://example.com/sitemap.xml" disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exampleArticleUrl" className="flex items-center gap-2"><FileText className="h-4 w-4"/>Example article URL</Label>
                  <Input id="exampleArticleUrl" value={exampleArticleUrl} onChange={(e)=>setExampleArticleUrl(e.target.value)} placeholder="https://example.com/blog/sample-article" disabled={isLoading} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Target className="h-4 w-4"/>Competitors (optional)</Label>
                <div className="flex gap-2">
                  <Input value={competitorInput} onChange={(e)=>setCompetitorInput(e.target.value)} onKeyDown={(e)=>{ if(e.key === "Enter"){ e.preventDefault(); addCompetitor(); } }} placeholder="domain.com" disabled={isLoading} />
                  <Button type="button" variant="outline" size="icon" onClick={addCompetitor} disabled={isLoading || !competitorInput.trim()}><Plus className="h-4 w-4"/></Button>
                </div>
                {competitors.length>0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {competitors.map(c => (
                      <Badge key={c} variant="secondary" className="flex items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://www.google.com/s2/favicons?domain=${c}&sz=16`} alt="" className="h-4 w-4" onError={(e)=>{ e.currentTarget.style.display = "none"; }} />
                        {c}
                        <button type="button" onClick={()=>removeCompetitor(c)} className="ml-1 text-muted-foreground hover:text-destructive" disabled={isLoading}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
          </SimpleAdvanced>

          <div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue to review
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default ConfigureStep;

// Minimal advanced section with show/hide behavior to avoid extra UI dependencies
function SimpleAdvanced({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md">
      <button type="button" onClick={()=>setOpen(!open)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
        <span>Advanced (optional): content sources & competitors</span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="p-4 space-y-6">{children}</div>}
    </div>
  );
}
