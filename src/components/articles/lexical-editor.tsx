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
import { Save, X, Bold, Italic, List, Link2, Quote, Heading1, Heading2 } from 'lucide-react';
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

interface LexicalEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  placeholder?: string;
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

export function LexicalEditor({ 
  initialContent = '', 
  onSave, 
  onCancel, 
  isLoading = false,
  placeholder = 'Start writing your article...'
}: LexicalEditorProps) {
  const [currentContent, setCurrentContent] = useState('');
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
      });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden lexical-editor">
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
              onClick={onCancel}
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
  );
}
