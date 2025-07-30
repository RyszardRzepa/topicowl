"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import Image from "next/image";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticleMetadataEditorProps {
  article: ArticleDetailResponse["data"];
  onSave: (
    updatedArticle: Partial<ArticleDetailResponse["data"]>,
  ) => Promise<void>;
  isLoading?: boolean;
}

export function ArticleMetadataEditor({
  article,
  onSave,
  isLoading = false,
}: ArticleMetadataEditorProps) {
  const [formData, setFormData] = useState({
    slug: article.slug ?? "",
    metaDescription: article.metaDescription ?? "",
    metaKeywords: Array.isArray(article.metaKeywords)
      ? (article.metaKeywords as string[])
      : [],
    coverImageUrl: article.coverImageUrl ?? "",
    coverImageAlt: article.coverImageAlt ?? "",
  });

  const [newKeyword, setNewKeyword] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4">
          {/* Cover Image Section */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Cover Image
            </label>
            {formData.coverImageUrl ? (
              <div className="group relative overflow-hidden rounded border">
                <Image
                  src={formData.coverImageUrl}
                  alt={formData.coverImageAlt || "Cover image preview"}
                  width={800}
                  height={620}
                  className="h-92 w-full object-cover"
                  unoptimized
                />
                <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center bg-black opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        coverImageUrl: "",
                        coverImageAlt: "",
                      }))
                    }
                    className="flex items-center gap-2"
                  >
                    <X className="h-3 w-3" />
                    Remove Image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <div>
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
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Input
                    id="coverImageAlt"
                    value={formData.coverImageAlt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        coverImageAlt: e.target.value,
                      }))
                    }
                    placeholder="Image description"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* SEO Fields */}
            <div>
              <label
                htmlFor="slug"
                className="mb-1 block text-xs font-medium text-gray-700"
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
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="metaDescription"
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Meta Description ({formData.metaDescription.length}/160)
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
                placeholder="SEO meta description"
                rows={1}
                maxLength={160}
                className="h-8 resize-none text-sm"
              />
            </div>
          </div>

          {/* Meta Keywords */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Keywords
            </label>
            <div className="mb-2 flex flex-wrap gap-1">
              {formData.metaKeywords.map((keyword, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex h-6 items-center gap-1 text-xs"
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
                className="h-8 flex-1 text-sm"
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                variant="outline"
                size="sm"
                className="h-8 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end border-t pt-2">
            <Button type="submit" disabled={isLoading} size="sm">
              <Save className="mr-2 h-3 w-3" />
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
