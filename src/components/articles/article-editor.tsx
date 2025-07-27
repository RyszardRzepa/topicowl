"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, XCircle } from "lucide-react";
import Image from "next/image";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticleEditorProps {
  article: ArticleDetailResponse["data"];
  onSave: (
    updatedArticle: Partial<ArticleDetailResponse["data"]>,
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ArticleEditor({
  article,
  onSave,
  onCancel,
  isLoading = false,
}: ArticleEditorProps) {
  const [formData, setFormData] = useState({
    title: article.title,
    description: article.description ?? "",
    targetAudience: article.targetAudience ?? "",
    metaDescription: article.metaDescription ?? "",
    keywords: Array.isArray(article.keywords)
      ? (article.keywords as string[])
      : [],
    draft: article.draft ?? "",
    optimizedContent: article.optimizedContent ?? "",
    coverImageUrl: article.coverImageUrl ?? "",
    coverImageAlt: article.coverImageAlt ?? "",
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
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter article title"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Enter article description"
              rows={3}
            />
          </div>

          <div>
            <label
              htmlFor="targetAudience"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Target Audience
            </label>
            <Input
              id="targetAudience"
              value={formData.targetAudience}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  targetAudience: e.target.value,
                }))
              }
              placeholder="e.g., Small business owners, Marketing professionals"
            />
          </div>

          <div>
            <label
              htmlFor="metaDescription"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Meta Description
            </label>
            <Textarea
              id="metaDescription"
              value={formData.metaDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  metaDescription: e.target.value,
                }))
              }
              placeholder="SEO meta description (max 160 characters)"
              rows={2}
              maxLength={160}
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.metaDescription.length}/160 characters
            </p>
          </div>

          {/* Cover Image */}
          <div>
            <label
              htmlFor="coverImageUrl"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Cover Image URL
            </label>
            <Input
              id="coverImageUrl"
              type="url"
              value={formData.coverImageUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  coverImageUrl: e.target.value,
                }))
              }
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label
              htmlFor="coverImageAlt"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Cover Image Alt Text
            </label>
            <Input
              id="coverImageAlt"
              value={formData.coverImageAlt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  coverImageAlt: e.target.value,
                }))
              }
              placeholder="Describe the image for accessibility"
            />
          </div>

          {/* Image Preview */}
          {formData.coverImageUrl && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Image Preview
              </label>
              <div className="overflow-hidden rounded-lg border">
                <Image
                  src={formData.coverImageUrl}
                  alt={formData.coverImageAlt || "Cover image preview"}
                  width={800}
                  height={300}
                  className="h-48 w-full object-cover"
                  unoptimized
                />
              </div>
            </div>
          )}

          {/* Keywords */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Keywords
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.keywords.map((keyword, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1"
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
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="draft"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Draft Content
            </label>
            <Textarea
              id="draft"
              value={formData.draft}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, draft: e.target.value }))
              }
              placeholder="Enter draft content"
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
