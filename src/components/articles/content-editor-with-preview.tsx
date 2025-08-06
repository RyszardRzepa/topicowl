"use client";

import { useRef, useState } from "react";
import { type MDXEditorMethods } from '@mdxeditor/editor'
import { ForwardRefEditor } from './ForwardRefEditor'
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Copy, Eye, Code } from "lucide-react";


interface ContentEditorWithPreviewProps {
  initialContent?: string;
  onSave: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ContentEditorWithPreview({
  initialContent = "",
  onSave,
  isLoading = false,
  placeholder = "Start writing your article...",
}: ContentEditorWithPreviewProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const [currentContent, setCurrentContent] = useState(initialContent);
  const [key, setKey] = useState(0);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);

  const handleSave = () => {
    const markdown = editorRef.current?.getMarkdown() ?? currentContent;
    onSave(markdown);
  };

  const handleCopyMarkdown = async () => {
    try {
      const markdown = editorRef.current?.getMarkdown() ?? currentContent;
      await navigator.clipboard.writeText(markdown);
      // You might want to add a toast notification here
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  const handleEditorChange = (markdown: string) => {
    setCurrentContent(markdown);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentContent(e.target.value);
  };

  const toggleMarkdownMode = () => {
    if (!isMarkdownMode) {
      // Switching to markdown mode - get current content from editor
      const markdown = editorRef.current?.getMarkdown() ?? '';
      setCurrentContent(markdown);
    }
    setIsMarkdownMode(!isMarkdownMode);
    setKey(prev => prev + 1); // Force editor re-render when switching back
  };

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  };

  return (
    <Card className="relative pb-20">
      <CardContent className="p-0 overflow-visible">
        <div className="mdx-editor">
          {isMarkdownMode ? (
            <textarea
              value={currentContent}
              onChange={handleTextareaChange}
              placeholder={placeholder}
              className="w-full min-h-[400px] p-4 font-mono text-sm border-none outline-none resize-none"
            />
          ) : (
            <ForwardRefEditor
              key={`editor-${initialContent.length}-${key}`}
              ref={editorRef}
              markdown={currentContent}
              onChange={handleEditorChange}
              placeholder={placeholder}
              contentEditableClassName="prose prose-lg max-w-none"
            />
          )}

          {/* Floating Editor Actions */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
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
