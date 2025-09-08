"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";
import { ArticleMetadata } from "./article-metadata";

interface ArticleSidebarEditorProps {
  article: ArticleDetailResponse["data"];
  currentMetadata?: {
    title: string;
    description: string;
    keywords: string[];
    slug: string;
    metaDescription: string;
  };
  onMetadataChange?: (metadata: {
    title: string;
    description: string;
    keywords: string[];
    slug: string;
    metaDescription: string;
  }) => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  articleStatus?: string;
}

// Article type options - you can expand this based on your needs
const ARTICLE_TYPES = [
  { value: "blog", label: "Blog Post" },
  { value: "news", label: "News Article" },
  { value: "tutorial", label: "Tutorial" },
  { value: "review", label: "Review" },
  { value: "guide", label: "Guide" },
  { value: "overview", label: "Overview" },
] as const;

export function ArticleSidebarEditor({
  article,
  currentMetadata,
  onMetadataChange,
  onSuccess,
  onError,
  articleStatus,
}: ArticleSidebarEditorProps) {
  const [formData, setFormData] = useState({
    title: currentMetadata?.title ?? article.title ?? "",
    description: currentMetadata?.description ?? article.description ?? "",
    keywords:
      currentMetadata?.keywords ??
      (Array.isArray(article.keywords) ? (article.keywords as string[]) : []),
    slug: currentMetadata?.slug ?? article.slug ?? "",
    metaDescription:
      currentMetadata?.metaDescription ?? article.metaDescription ?? "",
    // For now, we'll use a simple string field for type
    // You can extend this to map to your existing data structure
    articleType: "blog" as string,
  });

  const [newKeyword, setNewKeyword] = useState("");

  // Notify parent when form data changes
  useEffect(() => {
    onMetadataChange?.({
      title: formData.title,
      description: formData.description,
      keywords: formData.keywords,
      slug: formData.slug,
      metaDescription: formData.metaDescription,
    });
  }, [formData, onMetadataChange]);

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((keyword) => keyword !== keywordToRemove),
    }));
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <ArticleMetadata article={article} />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-b pb-4">
          
          </div>
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Article title"
              className="text-sm"
              disabled={articleStatus === "published"}
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Keywords
            </label>
            <div className="mb-2 flex flex-wrap gap-1">
              {formData.keywords.map((keyword, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-1 hover:text-red-600"
                    disabled={articleStatus === "published"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                className="text-sm"
                disabled={articleStatus === "published"}
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                variant="outline"
                size="sm"
                className="px-2"
                disabled={articleStatus === "published"}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Type */}
          <div>
            <label
              htmlFor="articleType"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Type
            </label>
            <select
              id="articleType"
              value={formData.articleType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  articleType: e.target.value,
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={articleStatus === "published"}
            >
              {ARTICLE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Meta Description */}
          <div>
            <label
              htmlFor="metaDescription"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Meta Description ({formData.metaDescription.length}/160)
            </label>
            <Textarea
              id="metaDescription"
              value={formData.metaDescription}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  metaDescription: e.target.value,
                }))
              }
              placeholder="SEO meta description"
              rows={3}
              maxLength={160}
              className="resize-none text-sm"
              disabled={articleStatus === "published"}
            />
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="slug"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Slug
            </label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="article-url-slug"
              className="text-sm"
              disabled={articleStatus === "published"}
            />
          </div>

          {/* Action Buttons section removed - save button moved to content editor */}
        </div>
      </CardContent>
    </Card>
  );
}
