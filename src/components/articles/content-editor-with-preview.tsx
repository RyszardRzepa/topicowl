'use client';

import { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, X, Bold, Italic, List, Link2, Quote, Heading1, Heading2, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import type { EditorState } from 'lexical';

// Toolbar component for formatting options
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const formatText = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-gray-50">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatText('bold')}
        className="h-8 w-8 p-0"
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatText('italic')}
        className="h-8 w-8 p-0"
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-gray-300 mx-2" />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-gray-300 mx-2" />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Insert Link"
      >
        <Link2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Plugin to auto-focus the editor when it loads
function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Small delay to ensure the editor is fully rendered
    const timer = setTimeout(() => {
      editor.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [editor]);

  return null;
}

// Plugin to initialize editor with markdown content
function InitializeMarkdownPlugin({ initialMarkdown }: { initialMarkdown: string }) {
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
  article?: {
    status?: string;
    keywords?: string[];
    metaDescription?: string;
  };
}

const theme = {
  // Define Lexical theme for styling
  paragraph: 'mb-4 leading-relaxed text-gray-700',
  heading: {
    h1: 'text-2xl font-bold mb-4 text-gray-900',
    h2: 'text-xl font-semibold mb-3 text-gray-900',
    h3: 'text-lg font-medium mb-2 text-gray-900',
  },
  list: {
    nested: {
      listitem: 'nested-list-item',
    },
    ol: 'list-decimal pl-6 mb-4 space-y-1',
    ul: 'list-disc pl-6 mb-4 space-y-1',
    listitem: 'text-gray-700',
  },
  text: {
    bold: 'font-semibold text-gray-900',
    italic: 'italic text-gray-700',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono',
  },
  quote: 'border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-600',
  link: 'text-blue-600 hover:text-blue-800 underline',
};

export function ContentEditorWithPreview({ 
  initialContent = '', 
  onSave, 
  isLoading = false,
  placeholder = 'Start writing your article...',
  article
}: ContentEditorWithPreviewProps) {
  const [currentContent, setCurrentContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const editorStateRef = useRef<EditorState | null>(null);

  const initialConfig = {
    namespace: 'ArticleEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical error:', error);
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
        setIsEditing(false);
      });
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentContent(initialContent);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Article Content</CardTitle>
        <div className="flex items-center gap-2">
          {!isEditing && currentContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Edit Content
            </Button>
          )}
          {article?.status && (
            <Badge variant={
              article.status === 'published' ? 'default' :
              article.status === 'wait_for_publish' ? 'secondary' :
              article.status === 'generating' ? 'red' : 'outline'
            }>
              {article.status.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="lexical-editor">
            <LexicalComposer initialConfig={initialConfig}>
              <ToolbarPlugin />
              <div className="relative">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable
                      className="min-h-[400px] p-6 focus:outline-none prose prose-lg max-w-none resize-none"
                      style={{ 
                        caretColor: '#3b82f6',
                      }}
                      aria-placeholder={placeholder}
                      placeholder={
                        <div className="absolute top-6 left-6 text-gray-400 pointer-events-none select-none">
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
                <AutoFocusPlugin />
                <InitializeMarkdownPlugin initialMarkdown={initialContent} />
              </div>
              
              {/* Editor Actions */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
                <div className="text-sm text-gray-500">
                  {currentContent.split(/\s+/).filter(word => word.length > 0).length} words
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </LexicalComposer>
          </div>
        ) : (
          <div className="space-y-4">
            {currentContent ? (
              <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900">
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks, remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-gray-900">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-gray-900">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-medium mb-2 text-gray-900">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-gray-700">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-600">{children}</blockquote>,
                  }}
                >
                  {currentContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="flex flex-col items-center gap-4">
                  <svg className="h-12 w-12 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">No content available yet</p>
                    <Button
                      variant="outline"
                      onClick={handleEdit}
                      className="mt-3"
                    >
                      Start Writing
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Additional article info */}
            {(article?.metaDescription ?? (article?.keywords && article.keywords.length > 0) ?? currentContent) && (
              <div className="pt-4 border-t space-y-4">
                {article?.metaDescription && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Meta Description</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                      {article.metaDescription}
                    </p>
                  </div>
                )}

                {article?.keywords && Array.isArray(article.keywords) && article.keywords.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {article.keywords.map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentContent && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Word Count</p>
                    <p className="text-sm text-gray-600">
                      {currentContent.split(/\s+/).filter(word => word.length > 0).length} words
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
