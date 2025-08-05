"use client";

import { useRef, useState } from "react";
import { type MDXEditorMethods } from '@mdxeditor/editor'
import { ForwardRefEditor } from './ForwardRefEditor'
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Copy } from "lucide-react";


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

  const handleSave = () => {
    const markdown = editorRef.current?.getMarkdown() ?? '';
    onSave(markdown);
  };

  const handleCopyMarkdown = async () => {
    try {
      const markdown = editorRef.current?.getMarkdown() ?? '';
      await navigator.clipboard.writeText(markdown);
      // You might want to add a toast notification here
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  const handleEditorChange = (markdown: string) => {
    setCurrentContent(markdown);
  };

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  };

  return (
    <Card className="relative">
      <CardContent className="p-0 overflow-visible">
        <div className="mdx-editor">
          <ForwardRefEditor
            key={`editor-${initialContent.length}-${key}`}
            ref={editorRef}
            markdown={initialContent}
            onChange={handleEditorChange}
            placeholder={placeholder}
            contentEditableClassName="prose prose-lg max-w-none"
          />

          {/* Editor Actions */}
          <div className="flex items-center justify-between border-t bg-gray-50 p-4">
            <div className="text-sm text-gray-500">
              {getWordCount(currentContent)} words
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCopyMarkdown}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy as markdown
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
      </CardContent>
    </Card>
  );
}
