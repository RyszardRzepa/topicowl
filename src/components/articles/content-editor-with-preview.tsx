"use client";

import { useRef, useState, Component, type ReactNode } from "react";
import { type MDXEditorMethods } from "@mdxeditor/editor";
import { ForwardRefEditor } from "./ForwardRefEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Code, Save } from "lucide-react";

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
  onContentChange?: (content: string) => void;
  onSave?: () => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
}

// Convert YouTube/video markdown links to iframe directive format
function sanitizeContentForEditor(content: string): string {
  let result = content;

  // 1. Convert legacy markdown thumbnail links to leaf iframe directive
  result = result.replace(
    /\[!\[[^\]]*\]\([^)]+\)\]\(https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:[^)]*)\)/g,
    (_m, videoId: string) =>
      `\n\n:iframe[https://www.youtube.com/watch?v=${videoId}]\n\n`,
  );

  // 2. Normalize container forms (multiline) to leaf
  result = result.replace(
    /:::\s*@?iframe\s*\n+\s*(https?:\/\/[^\n\r]+?)\s*\n+:::/g,
    (_m, url: string) => `:iframe[${url.trim()}]`,
  );

  // 3. Normalize single line container form
  result = result.replace(
    /:::\s*@?iframe\s+(https?:\/\/[^\n\r]+?)\s*:::/g,
    (_m, url: string) => `:iframe[${url.trim()}]`,
  );

  // 4. Normalize bracket container variant
  result = result.replace(
    /:::iframe\[([^\]]+)\]/g,
    (_m, url: string) => `:iframe[${url.trim()}]`,
  );

  // 5. Remove accidental whitespace inside leaf directive brackets
  result = result.replace(
    /:iframe\[\s*([^\]]*?)\s*\]/g,
    (_m, url: string) => `:iframe[${url}]`,
  );

  return result;
}
// Convert iframe directives back to standard format for saving
function convertDirectivesToMarkdown(content: string): string {
  // Handle leaf directive syntax: :iframe[URL]
  let result = content.replace(
    /:iframe\[([^\]]+)\]/g,
    (_match: string, url: string) => {
      // Extract video ID from YouTube URL for thumbnail
      const youtubeRegex =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
      const youtubeMatch = youtubeRegex.exec(url);
      if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const linkTitle = "Watch on YouTube";
        return `[![${linkTitle}](https://img.youtube.com/vi/${videoId}/hqdefault.jpg)](${url})`;
      }
      // For non-YouTube URLs, just create a basic link
      return `[View Content](${url})`;
    },
  );

  // Handle container syntax: ::: iframe URL :::
  result = result.replace(
    /:::\s*iframe\s*\n([^\n\r]+?)\n:::/g,
    (_match: string, url: string) => {
      const cleanUrl = url.trim();
      // Extract video ID from YouTube URL for thumbnail
      const youtubeRegex =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
      const youtubeMatch = youtubeRegex.exec(cleanUrl);
      if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const linkTitle = "Watch on YouTube";
        return `[![${linkTitle}](https://img.youtube.com/vi/${videoId}/hqdefault.jpg)](${cleanUrl})`;
      }
      // For non-YouTube URLs, just create a basic link
      return `[View Content](${cleanUrl})`;
    },
  );

  // Handle bracket syntax: :::iframe[URL]
  result = result.replace(
    /:::iframe\[([^\]]+)\]/g,
    (_match: string, url: string) => {
      // Extract video ID from YouTube URL for thumbnail
      const youtubeRegex =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
      const youtubeMatch = youtubeRegex.exec(url);
      if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const linkTitle = "Watch on YouTube";
        return `[![${linkTitle}](https://img.youtube.com/vi/${videoId}/hqdefault.jpg)](${url})`;
      }
      // For non-YouTube URLs, just create a basic link
      return `[View Content](${url})`;
    },
  );

  return result;
}

export function ContentEditorWithPreview({
  initialContent = "",
  onContentChange,
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

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  // Copy markdown functionality (handleCopyMarkdown) removed due to being unused.

  const handleEditorChange = (markdown: string) => {
    setCurrentContent(markdown);
    // Convert directives back to markdown format and notify parent
    const convertedMarkdown = convertDirectivesToMarkdown(markdown);
    onContentChange?.(convertedMarkdown);
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
    const newContent = e.target.value;
    setCurrentContent(newContent);
    // Convert directives back to markdown format and notify parent
    const convertedMarkdown = convertDirectivesToMarkdown(newContent);
    onContentChange?.(convertedMarkdown);
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
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
