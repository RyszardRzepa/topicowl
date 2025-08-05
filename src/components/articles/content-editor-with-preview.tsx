"use client";

import { useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Save,
  Copy,
} from "lucide-react";
import type { EditorState } from "lexical";

// Plugin to auto-focus the editor when it loads (disabled to prevent auto-scroll)
function AutoFocusPlugin({ disabled = false }: { disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (disabled) return;
    
    // Small delay to ensure the editor is fully rendered
    const timer = setTimeout(() => {
      editor.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [editor, disabled]);

  return null;
}

// Plugin to initialize editor with markdown content
function InitializeMarkdownPlugin({
  initialMarkdown,
}: {
  initialMarkdown: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && initialMarkdown) {
      editor.update(() => {
        $convertFromMarkdownString(initialMarkdown, TRANSFORMERS);
      });
      setIsInitialized(true);
    }
  }, [editor, initialMarkdown, isInitialized]);

  return null;
}

interface ContentEditorWithPreviewProps {
  initialContent?: string;
  onSave: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const theme = {
  // Define Lexical theme for styling
  paragraph: "mb-4 leading-relaxed text-gray-700",
  heading: {
    h1: "text-2xl font-bold mb-4 text-gray-900",
    h2: "text-xl font-semibold mb-3 text-gray-900",
    h3: "text-lg font-medium mb-2 text-gray-900",
  },
  list: {
    nested: {
      listitem: "nested-list-item",
    },
    ol: "list-decimal pl-6 mb-4 space-y-1",
    ul: "list-disc pl-6 mb-4 space-y-1",
    listitem: "text-gray-700",
  },
  text: {
    bold: "font-semibold text-gray-900",
    italic: "italic text-gray-700",
    underline: "underline",
    strikethrough: "line-through",
    code: "bg-gray-100 px-1 py-0.5 rounded text-sm font-mono",
  },
  quote: "border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-600",
  link: "text-blue-600 hover:text-blue-800 underline",
};

export function ContentEditorWithPreview({
  initialContent = "",
  onSave,
  isLoading = false,
  placeholder = "Start writing your article...",
}: ContentEditorWithPreviewProps) {
  const [currentContent, setCurrentContent] = useState(initialContent);
  const editorStateRef = useRef<EditorState | null>(null);

  const initialConfig = {
    namespace: "ArticleEditor",
    theme,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      CodeHighlightNode,
      CodeNode,
    ],
  };

  const handleChange = (editorState: EditorState) => {
    editorStateRef.current = editorState;
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      setCurrentContent(markdown);
    });
  };

  const handleSave = () => {
    if (editorStateRef.current) {
      editorStateRef.current.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        onSave(markdown);
      });
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      // You might want to add a toast notification here
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="lexical-editor">
          <LexicalComposer initialConfig={initialConfig}>
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="prose prose-lg min-h-[400px] max-w-none resize-none p-6 focus:outline-none"
                    style={{
                      caretColor: "#3b82f6",
                    }}
                    aria-placeholder={placeholder}
                    placeholder={
                      <div className="pointer-events-none absolute top-6 left-6 text-gray-400 select-none">
                        {placeholder}
                      </div>
                    }
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <OnChangePlugin onChange={handleChange} />
              <HistoryPlugin />
              <LinkPlugin />
              <ListPlugin />
              <AutoFocusPlugin disabled={true} />
              <InitializeMarkdownPlugin initialMarkdown={initialContent} />
            </div>

            {/* Editor Actions */}
            <div className="flex items-center justify-between border-t bg-gray-50 p-4">
              <div className="text-sm text-gray-500">
                {
                  currentContent.split(/\s+/).filter((word) => word.length > 0)
                    .length
                }{" "}
                words
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
          </LexicalComposer>
        </div>
      </CardContent>
    </Card>
  );
}
