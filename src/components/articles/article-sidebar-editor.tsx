"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticleSidebarEditorProps {
  article: ArticleDetailResponse["data"];
  onSave: (
    updatedArticle: Partial<ArticleDetailResponse["data"]>,
  ) => Promise<void>;
  isLoading?: boolean;
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
  onSave,
  isLoading = false,
}: ArticleSidebarEditorProps) {
  const [formData, setFormData] = useState({
    title: article.title ?? "",
    description: article.description ?? "",
    keywords: Array.isArray(article.keywords)
      ? (article.keywords as string[])
      : [],
    slug: article.slug ?? "",
    metaDescription: article.metaDescription ?? "",
    // For now, we'll use a simple string field for type
    // You can extend this to map to your existing data structure
    articleType: "blog" as string,
  });

  const [newKeyword, setNewKeyword] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title: formData.title,
      description: formData.description,
      keywords: formData.keywords,
      slug: formData.slug,
      metaDescription: formData.metaDescription,
    });
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Article Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
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
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                variant="outline"
                size="sm"
                className="px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Type */}
          <div>
            <label 
              htmlFor="articleType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type
            </label>
            <select
              id="articleType"
              value={formData.articleType}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, articleType: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="block text-sm font-medium text-gray-700 mb-1"
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
              className="text-sm resize-none"
            />
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700 mb-1"
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
            />
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
