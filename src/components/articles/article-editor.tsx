"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, XCircle, Link, Search } from "lucide-react";
import Image from "next/image";
import { ImagePicker } from "./image-picker";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";
import type { CombinedImage } from "@/lib/services/image-selection-service";

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
    slug: article.slug ?? "",
    metaDescription: article.metaDescription ?? "",
    metaKeywords: Array.isArray(article.metaKeywords)
      ? (article.metaKeywords as string[])
      : [],
    content: article.content ?? "",
    coverImageUrl: article.coverImageUrl ?? "",
    coverImageAlt: article.coverImageAlt ?? "",
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [imageInputMode, setImageInputMode] = useState<"url" | "search">("url");
  const [selectedUnsplashImage, setSelectedUnsplashImage] =
    useState<CombinedImage | null>(null);

  const handleAddKeyword = () => {
    if (
      newKeyword.trim() &&
      !formData.metaKeywords.includes(newKeyword.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        metaKeywords: [...prev.metaKeywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      metaKeywords: prev.metaKeywords.filter(
        (keyword) => keyword !== keywordToRemove,
      ),
    }));
  };

  const handleUnsplashImageSelect = (image: CombinedImage) => {
    setSelectedUnsplashImage(image);
    setFormData((prev) => ({
      ...prev,
      coverImageUrl: image.urls.regular,
      coverImageAlt:
        image.altDescription ??
        image.description ??
        `Photo by ${image.user.name}`,
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
          <CardTitle>SEO & Meta Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="article-url-slug"
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

          {/* Meta Keywords */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Meta Keywords
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.metaKeywords.map((keyword, index) => (
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
                placeholder="Add meta keyword"
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

      {/* Cover Image */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cover Image</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={imageInputMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setImageInputMode("url")}
              >
                <Link className="mr-1 h-4 w-4" />
                URL
              </Button>
              <Button
                type="button"
                variant={imageInputMode === "search" ? "default" : "outline"}
                size="sm"
                onClick={() => setImageInputMode("search")}
              >
                <Search className="mr-1 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {imageInputMode === "url" ? (
            <>
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
            </>
          ) : (
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">
                Search Images
              </label>
              <ImagePicker
                onImageSelect={handleUnsplashImageSelect}
                selectedImageId={selectedUnsplashImage?.id}
              />

              {/* Show alt text input for selected image */}
              {selectedUnsplashImage && (
                <div className="mt-4">
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
              )}
            </div>
          )}

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
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Article Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="content"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Article Content
            </label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  content: e.target.value,
                }))
              }
              placeholder="Enter article content"
              rows={15}
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
