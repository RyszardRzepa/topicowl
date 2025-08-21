"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CoverImageDisplay } from "./cover-image-display";
import { ArticleSidebarEditor } from "./article-sidebar-editor";
import { ContentEditorWithPreview } from "./content-editor-with-preview";
import { GenerationProgress } from "./generation-progress";
import { useGenerationPolling } from "@/hooks/use-generation-polling";
import { useCreditContext } from "@/components/dashboard/credit-context";
import { getArticleContent } from "@/lib/utils";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticlePreviewClientProps {
  initialArticle: ArticleDetailResponse["data"];
}

export function ArticlePreviewClient({
  initialArticle,
}: ArticlePreviewClientProps) {
  const [article, setArticle] = useState(initialArticle);
  const [currentContent, setCurrentContent] = useState(getArticleContent(initialArticle));
  const [currentMetadata, setCurrentMetadata] = useState({
    title: initialArticle.title ?? "",
    description: initialArticle.description ?? "",
    keywords: Array.isArray(initialArticle.keywords)
      ? (initialArticle.keywords as string[])
      : [],
    slug: initialArticle.slug ?? "",
    metaDescription: initialArticle.metaDescription ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(
    null,
  );
  const [showErrorMessage, setShowErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const { refreshCredits } = useCreditContext();

  // Use generation status polling for articles in "generating" status
  const { status: generationStatus } = useGenerationPolling({
    articleId: article.id.toString(),
    enabled: article.status === "generating",
    onStatusUpdate: (status) => {
      // Update article status when generation progresses
      if (status.status === "completed") {
        setShowSuccessMessage("Article generation completed successfully!");
        setTimeout(() => setShowSuccessMessage(null), 5000);
        // Refresh the page to get the updated content
        router.refresh();
      } else if (status.status === "failed") {
        setShowErrorMessage(status.error ?? "Article generation failed");
        setTimeout(() => setShowErrorMessage(null), 5000);
        // Refresh the page to get the updated status
        router.refresh();
      }
    },
    onComplete: () => {
      // Update the article state when generation is complete
      setArticle((prev) => ({
        ...prev,
        status: "wait_for_publish",
      }));
      // Refresh credits since generation completed and credits were deducted
      void refreshCredits();
    },
    onError: (error) => {
      setShowErrorMessage(`Generation status error: ${error}`);
      setTimeout(() => setShowErrorMessage(null), 5000);
    },
  });

  // Handle article save
  const handleSave = useCallback(
    async (updatedData: Partial<ArticleDetailResponse["data"]>) => {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/articles/${article.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedData),
        });

        if (!response.ok) {
          throw new Error("Failed to update article");
        }

        await response.json();

        // Update local state
        setArticle((prev) => ({ ...prev, ...updatedData }));
        setShowSuccessMessage("Article updated successfully!");
        setTimeout(() => setShowSuccessMessage(null), 3000);

        // Refresh the page data
        router.refresh();
      } catch (error) {
        console.error("Save error:", error);
        setShowErrorMessage("Failed to save article changes");
        setTimeout(() => setShowErrorMessage(null), 5000);
      } finally {
        setIsSaving(false);
      }
    },
    [article.id, router],
  );

  // Handle cover image save
  const handleCoverImageSave = useCallback(
    async (imageData: { coverImageUrl: string; coverImageAlt: string }) => {
      await handleSave(imageData);
    },
    [handleSave],
  );

  // Handle content changes without saving (for unified save)
  const handleContentChange = useCallback((content: string) => {
    setCurrentContent(content);
  }, []);

  // Handle metadata changes without saving (for unified save)
  const handleMetadataChange = useCallback((metadata: typeof currentMetadata) => {
    setCurrentMetadata(metadata);
  }, []);

  // Unified save function for both content and metadata
  const handleUnifiedSave = useCallback(async () => {
    await handleSave({
      title: currentMetadata.title,
      description: currentMetadata.description,
      keywords: currentMetadata.keywords,
      slug: currentMetadata.slug,
      metaDescription: currentMetadata.metaDescription,
      draft: currentContent,
    });
  }, [handleSave, currentMetadata, currentContent]);

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {showSuccessMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {showSuccessMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {showErrorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                {showErrorMessage}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Generation Progress - Show when article is generating and we have status */}
      {article.status === "generating" && generationStatus && (
        <GenerationProgress status={generationStatus} />
      )}

      {/* Main Layout - Two Column */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main Content Area - Cover Image + Content Editor */}
        <div className="flex-1 space-y-6">
          {/* Cover Image Display */}
          <CoverImageDisplay
            coverImageUrl={article.coverImageUrl ?? undefined}
            coverImageAlt={article.coverImageAlt ?? undefined}
            onImageUpdate={handleCoverImageSave}
            isLoading={isSaving}
          />        

          {/* Content Editor */}
          <ContentEditorWithPreview
            initialContent={getArticleContent(article)}
            onContentChange={handleContentChange}
            onSave={handleUnifiedSave}
            isLoading={isSaving}
            placeholder="Start writing your article content..."
          />
        </div>

        {/* Sidebar - Form Fields */}
        <div className="w-full lg:w-80 xl:w-96">
          <ArticleSidebarEditor
            article={article}
            currentMetadata={currentMetadata}
            onMetadataChange={handleMetadataChange}
            onSuccess={(message) => {
              setShowSuccessMessage(message);
              setTimeout(() => setShowSuccessMessage(null), 5000);
            }}
            onError={(message) => {
              setShowErrorMessage(message);
              setTimeout(() => setShowErrorMessage(null), 5000);
            }}
          />
        </div>
      </div>
    </div>
  );
}
