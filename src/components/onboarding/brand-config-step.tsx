"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building } from "lucide-react";

interface BrandConfigStepProps {
  initialData?: {
    companyName: string;
    productDescription: string;
    targetAudience: string;
    toneOfVoice: string;
    keywords: string[];
  };
  onSubmit: (data: {
    companyName: string;
    productDescription: string;
    targetAudience: string;
    toneOfVoice: string;
    keywords: string[];
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

export function BrandConfigStep({ initialData, onSubmit, isLoading = false }: BrandConfigStepProps) {
  const [companyName, setCompanyName] = useState(initialData?.companyName ?? "");
  const [productDescription, setProductDescription] = useState(initialData?.productDescription ?? "");
  const [targetAudience, setTargetAudience] = useState(initialData?.targetAudience ?? "");
  const [toneOfVoice, setToneOfVoice] = useState(initialData?.toneOfVoice ?? "");
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords ?? []);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!companyName.trim()) newErrors.companyName = "Company name is required";
    if (!productDescription.trim()) newErrors.productDescription = "Product description is required";
    if (!targetAudience.trim()) newErrors.targetAudience = "Target audience is required";
    if (!toneOfVoice) newErrors.toneOfVoice = "Please select a tone of voice";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addKeyword = () => {
    const keyword = currentKeyword.trim().toLowerCase();
    if (keyword && !keywords.includes(keyword)) {
      setKeywords((prev) => [...prev, keyword]);
      setCurrentKeyword("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords((prev) => prev.filter((k) => k !== keywordToRemove));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSubmit({
      companyName: companyName.trim(),
      productDescription: productDescription.trim(),
      targetAudience: targetAudience.trim(),
      toneOfVoice,
      keywords,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl md:text-3xl">
          <Building className="h-5 w-5" />
          Brand & Voice Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">Fine-tune your brand information and content strategy settings.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Single-column fields stacked vertically */}
          <div className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: "" }));
                }}
                placeholder="Your Company Name"
                className={errors.companyName ? "border-red-500" : ""}
                disabled={isLoading}
              />
              {errors.companyName && <p className="text-sm text-red-600">{errors.companyName}</p>}
            </div>

            {/* Product Description */}
            <div className="space-y-2">
              <Label htmlFor="productDescription">Product/Service Description *</Label>
              <Textarea
                id="productDescription"
                value={productDescription}
                onChange={(e) => {
                  setProductDescription(e.target.value);
                  if (errors.productDescription) setErrors((prev) => ({ ...prev, productDescription: "" }));
                }}
                placeholder="Describe what your company does and the products/services you offer..."
                className={errors.productDescription ? "border-red-500" : ""}
                rows={4}
                disabled={isLoading}
              />
              {errors.productDescription && <p className="text-sm text-red-600">{errors.productDescription}</p>}
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience *</Label>
              <Textarea
                id="targetAudience"
                value={targetAudience}
                onChange={(e) => {
                  setTargetAudience(e.target.value);
                  if (errors.targetAudience) setErrors((prev) => ({ ...prev, targetAudience: "" }));
                }}
                placeholder="Describe your ideal customers, demographics, interests, and pain points..."
                className={errors.targetAudience ? "border-red-500" : ""}
                rows={3}
                disabled={isLoading}
              />
              {errors.targetAudience && <p className="text-sm text-red-600">{errors.targetAudience}</p>}
            </div>

            {/* Tone of Voice */}
            <div className="space-y-2">
              <Label htmlFor="toneOfVoice">Tone of Voice *</Label>
              <Select
                value={toneOfVoice}
                onValueChange={(value) => {
                  setToneOfVoice(value);
                  if (errors.toneOfVoice) setErrors((prev) => ({ ...prev, toneOfVoice: "" }));
                }}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.toneOfVoice ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select tone of voice" />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.toneOfVoice && <p className="text-sm text-red-600">{errors.toneOfVoice}</p>}
            </div>

            {/* Primary Keywords - horizontal single-line scroll */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Primary Keywords</Label>
              <div className="flex gap-2">
                <Input
                  id="keywords"
                  value={currentKeyword}
                  onChange={(e) => setCurrentKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Add keyword and press Enter"
                  disabled={isLoading}
                />
                <Button type="button" onClick={addKeyword} disabled={isLoading || !currentKeyword.trim()} variant="outline">
                  Add
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="mt-2 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
                  <div className="inline-flex gap-2 pr-1">
                    {keywords.map((keyword) => (
                      <span key={keyword} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          disabled={isLoading}
                          aria-label={`Remove ${keyword}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
