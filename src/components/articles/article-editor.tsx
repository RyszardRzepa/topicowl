'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, XCircle } from "lucide-react";
import type { ArticleDetailResponse } from '@/app/api/articles/[id]/route';

interface ArticleEditorProps {
  article: ArticleDetailResponse['data'];
  onSave: (updatedArticle: Partial<ArticleDetailResponse['data']>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ArticleEditor({ article, onSave, onCancel, isLoading = false }: ArticleEditorProps) {
  const [formData, setFormData] = useState({
    title: article.title,
    description: article.description || '',
    targetAudience: article.targetAudience || '',
    metaDescription: article.metaDescription || '',
    keywords: Array.isArray(article.keywords) ? (article.keywords as string[]) : [],
    draft: article.draft || '',
    optimizedContent: article.optimizedContent || '',
  });

  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(keyword => keyword !== keywordToRemove)
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
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter article title"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter article description"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-1">
              Target Audience
            </label>
            <Input
              id="targetAudience"
              value={formData.targetAudience}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="e.g., Small business owners, Marketing professionals"
            />
          </div>

          <div>
            <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
            </label>
            <Textarea
              id="metaDescription"
              value={formData.metaDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
              placeholder="SEO meta description (max 160 characters)"
              rows={2}
              maxLength={160}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.metaDescription.length}/160 characters
            </p>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.keywords.map((keyword, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
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
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button type="button" onClick={handleAddKeyword} variant="outline" size="sm">
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
            <label htmlFor="draft" className="block text-sm font-medium text-gray-700 mb-1">
              Draft Content
            </label>
            <Textarea
              id="draft"
              value={formData.draft}
              onChange={(e) => setFormData(prev => ({ ...prev, draft: e.target.value }))}
              placeholder="Enter draft content"
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="optimizedContent" className="block text-sm font-medium text-gray-700 mb-1">
              Optimized Content
            </label>
            <Textarea
              id="optimizedContent"
              value={formData.optimizedContent}
              onChange={(e) => setFormData(prev => ({ ...prev, optimizedContent: e.target.value }))}
              placeholder="Enter optimized content"
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <XCircle className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </form>
  );
}