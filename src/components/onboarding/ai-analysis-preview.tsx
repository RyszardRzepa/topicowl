"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
};

interface AIAnalysisPreviewProps {
  analysisData: AnalysisData;
  onConfirm: () => Promise<void>;
  onEdit: (field: string, value: unknown) => void;
  isLoading: boolean;
}

export function AIAnalysisPreview({
  analysisData,
  onConfirm,
  onEdit,
  isLoading,
}: AIAnalysisPreviewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localData, setLocalData] = useState(analysisData);

  if (!localData) {
    return <div>No analysis data available</div>;
  }

  const handleFieldEdit = (
    field: string,
    value: string | number | string[],
  ) => {
    const updatedData = { ...localData };

    if (field.includes(".")) {
      // Handle nested fields like 'contentStrategy.maxWords'
      const [parent, child] = field.split(".");
      if (parent === "contentStrategy") {
        updatedData.contentStrategy = {
          ...updatedData.contentStrategy,
          [child as keyof typeof updatedData.contentStrategy]: value,
        };
      }
    } else if (field === "suggestedKeywords") {
      updatedData[field] = value as string[];
    } else {
      updatedData[field as keyof AnalysisData] = value as never;
    }

    setLocalData(updatedData);
    onEdit(field, value);
    setEditingField(null);
  };

  const handleKeywordEdit = (keywords: string) => {
    const keywordArray = keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    handleFieldEdit("suggestedKeywords", keywordArray);
  };

  const renderEditableField = (
    label: string,
    field: string,
    value: string,
    type: "text" | "textarea" = "text",
    disabled = false,
  ) => {
    const isEditing = editingField === field;

    return (
      <div className="space-y-2">
        <Label className="block">{label}</Label>
        {isEditing && !disabled ? (
          <div className="space-y-2">
            {type === "textarea" ? (
              <Textarea
                defaultValue={value}
                rows={3}
                onBlur={(e) => handleFieldEdit(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFieldEdit(field, e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <Input
                type="text"
                defaultValue={value}
                onBlur={(e) => handleFieldEdit(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFieldEdit(field, e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                autoFocus
              />
            )}
            <div className="text-muted-foreground text-xs">
              Press Enter to save, Escape to cancel
            </div>
          </div>
        ) : (
          <div className="group flex items-start justify-between">
            <div className="flex-1">
              {type === "textarea" ? (
                <p className="text-foreground whitespace-pre-wrap">{value}</p>
              ) : (
                <p className="text-foreground">{value}</p>
              )}
              {disabled && (
                <p className="text-muted-foreground mt-1 text-xs">
                  This field cannot be edited
                </p>
              )}
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingField(field)}
                className="ml-2 opacity-0 transition-opacity group-hover:opacity-100"
                type="button"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Review Your Content Settings
          </CardTitle>
          <CardDescription>
            We&apos;ve analyzed your website and created these settings. You can
            edit any field by clicking on it.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="border-b pb-2 text-lg">
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderEditableField(
              "Company Name",
              "companyName",
              localData.companyName,
            )}
            {renderEditableField(
              "Domain",
              "domain",
              localData.domain,
              "text",
              true,
            )}
            {renderEditableField(
              "Product Description",
              "productDescription",
              localData.productDescription,
              "textarea",
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="border-b pb-2 text-lg">
              Content Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderEditableField(
              "Industry Category",
              "industryCategory",
              localData.industryCategory,
            )}
            {renderEditableField(
              "Target Audience",
              "targetAudience",
              localData.targetAudience,
            )}
            {renderEditableField(
              "Tone of Voice",
              "toneOfVoice",
              localData.toneOfVoice,
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="border-b pb-2 text-lg">
            Suggested Keywords
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingField === "suggestedKeywords" ? (
            <div className="space-y-2">
              <Input
                defaultValue={localData.suggestedKeywords.join(", ")}
                placeholder="Enter keywords separated by commas"
                onBlur={(e) => handleKeywordEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleKeywordEdit(e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                autoFocus
              />
              <div className="text-muted-foreground text-xs">
                Press Enter to save, Escape to cancel. Separate keywords with
                commas.
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="mb-2 flex flex-wrap gap-2">
                {localData.suggestedKeywords.map((keyword, index) => (
                  <Badge key={index} variant="green">
                    {keyword}
                  </Badge>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingField("suggestedKeywords")}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                type="button"
              >
                <svg
                  className="mr-1 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit keywords
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating action button - always visible at bottom */}
      <div className="fixed bottom-2 left-1/2 z-50 -translate-x-1/2 transform">
        <Card className="px-4 py-2">
          <CardContent className="flex justify-center px-2 py-2">
            <Button onClick={onConfirm} disabled={isLoading} size="lg">
              {isLoading ? "Setting up..." : "Complete Setup"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Spacer to prevent content from being hidden behind floating button */}
      <div className="h-24"></div>
    </div>
  );
}
