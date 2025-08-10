"use client";

import { useRef, useState, Component, type ReactNode } from "react";
import { type MDXEditorMethods } from "@mdxeditor/editor";
import { ForwardRefEditor } from "./ForwardRefEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Eye, Code } from "lucide-react";

// Error boundary for the MDX editor
class EditorErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null; // The parent component will handle showing the fallback
    }

    return this.props.children;
  }
}

interface ContentEditorWithPreviewProps {
  initialContent?: string;
  onSave: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

// Convert YouTube markdown links to clean directive format
function sanitizeContentForEditor(content: string): string {
  console.log("Original content:", content);

  // Use the correct directive syntax: ::youtube[Title]{#videoId}
  const result = content.replace(
    /\[!\[([^\]]*)\]\([^)]+\)\]\(https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:[^)]*)\)/g,
    (_match: string, altText: string, videoId: string) => {
      console.log("Found YouTube link, videoId:", videoId);
      const title = altText || "Watch on YouTube";
      return `\n\n::youtube[${title}]{#${videoId}}\n\n`;
    },
  );

  console.log("Converted content:", result);
  return result;
}

// Convert directives back to standard format for saving
function convertDirectivesToMarkdown(content: string): string {
  return content.replace(
    /::youtube\[([^\]]*)\]\{#([^}]+)\}/g,
    (_match: string, title: string, videoId: string) => {
      const linkTitle = title || "Watch on YouTube";
      return `[![${linkTitle}](https://img.youtube.com/vi/${videoId}/hqdefault.jpg)](https://www.youtube.com/watch?v=${videoId})`;
    },
  );
}

export function ContentEditorWithPreview({
  initialContent = "",
  onSave,
  isLoading = false,
  placeholder = "Start writing your article...",
}: ContentEditorWithPreviewProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const sanitizedInitialContent = sanitizeContentForEditor(initialContent);
  const [currentContent, setCurrentContent] = useState(sanitizedInitialContent);
  const [key, setKey] = useState(0);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Debug logging
  console.log(
    "ContentEditor - original content length:",
    initialContent.length,
  );
  console.log(
    "ContentEditor - sanitized content length:",
    sanitizedInitialContent.length,
  );
  console.log("ContentEditor - currentContent length:", currentContent.length);

  // Check if content was sanitized
  if (initialContent !== sanitizedInitialContent) {
    console.log("ContentEditor - content was converted to directives");
    console.log(
      "ContentEditor - original YouTube section:",
      initialContent.substring(
        Math.max(0, initialContent.indexOf("youtube.com") - 50),
        initialContent.indexOf("youtube.com") + 150,
      ),
    );
    console.log(
      "ContentEditor - directive YouTube section:",
      sanitizedInitialContent.substring(
        Math.max(0, sanitizedInitialContent.indexOf("::youtube") - 10),
        sanitizedInitialContent.indexOf("::youtube") + 100,
      ),
    );
  }

  const handleSave = () => {
    const markdown = editorRef.current?.getMarkdown() ?? currentContent;
    // Convert directives back to markdown format for saving
    const convertedMarkdown = convertDirectivesToMarkdown(markdown);
    onSave(convertedMarkdown);
  };

  // Copy markdown functionality (handleCopyMarkdown) removed due to being unused.

  const handleEditorChange = (markdown: string) => {
    setCurrentContent(markdown);
    // Clear any previous errors when content changes successfully
    if (editorError) {
      setEditorError(null);
    }
  };

  const handleEditorError = (error: Error) => {
    console.error("MDX Editor error:", error);
    setEditorError(error.message);
    // Fall back to markdown mode when editor fails
    setIsMarkdownMode(true);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentContent(e.target.value);
  };

  const toggleMarkdownMode = () => {
    if (!isMarkdownMode) {
      // Switching to markdown mode - get current content from editor
      const markdown = editorRef.current?.getMarkdown() ?? "";
      setCurrentContent(markdown);
    }
    setIsMarkdownMode(!isMarkdownMode);
    setKey((prev) => prev + 1); // Force editor re-render when switching back
  };

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  };

  return (
    <Card className="relative pb-20">
      <CardContent className="overflow-visible p-0">
        <div className="mdx-editor">
          {editorError && (
            <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800">
                <strong>Editor Error:</strong> {editorError}
              </p>
              <p className="mt-1 text-xs text-yellow-600">
                Switched to markdown mode. You can continue editing in raw
                markdown.
              </p>
            </div>
          )}

          {isMarkdownMode || editorError ? (
            <textarea
              value={currentContent}
              onChange={handleTextareaChange}
              placeholder={placeholder}
              className="min-h-[400px] w-full resize-none border-none p-4 font-mono text-sm outline-none"
            />
          ) : (
            <EditorErrorBoundary onError={handleEditorError}>
              <ForwardRefEditor
                key={`editor-${sanitizedInitialContent.length}-${key}`}
                ref={editorRef}
                markdown={currentContent}
                onChange={handleEditorChange}
                placeholder={placeholder}
                contentEditableClassName="prose prose-lg max-w-none"
              />
            </EditorErrorBoundary>
          )}

          {/* Floating Editor Actions */}
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {getWordCount(currentContent)} words
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={toggleMarkdownMode}
                  className="flex items-center gap-2"
                >
                  {isMarkdownMode ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  ) : (
                    <>
                      <Code className="h-4 w-4" />
                      Edit in Markdown
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? "Saving..." : "Save Content"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
