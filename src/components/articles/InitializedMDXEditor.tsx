"use client";

import type { ForwardedRef } from "react";
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  directivesPlugin,
  type DirectiveDescriptor,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertTable,
  BlockTypeSelect,
  CodeToggle,
  ListsToggle,
  Separator,
} from "@mdxeditor/editor";

import { IFrame } from "@/components/IFrame";

// Lightweight typed shapes (subset of mdast) to avoid unsafe any usage
interface BaseNode { type: string }
interface TextNode extends BaseNode { type: 'text'; value: string }
interface ParagraphNode extends BaseNode { type: 'paragraph'; children: Array<TextNode | BaseNode> }
interface DirectiveNode extends BaseNode {
  name?: string;
  label?: string;
  attributes?: Record<string, string>;
  children?: Array<ParagraphNode | TextNode | DirectiveNode>;
}

function isText(node: unknown): node is TextNode {
  return typeof node === 'object' && node !== null && (node as { type?: string }).type === 'text' && typeof (node as { value?: unknown }).value === 'string';
}
function isParagraph(node: unknown): node is ParagraphNode {
  return typeof node === 'object' && node !== null && (node as { type?: string }).type === 'paragraph' && Array.isArray((node as { children?: unknown }).children);
}
function isDirective(node: unknown): node is DirectiveNode {
  return typeof node === 'object' && node !== null && typeof (node as { type?: string }).type === 'string' && 'name' in node;
}

function extractUrlFromDirective(node: DirectiveNode): string | undefined {
  // Direct sources first
  const direct = node.label?.trim() ?? node.attributes?.src ?? node.attributes?.url;
  if (direct) return direct;

  // Scan children paragraphs and text for a URL looking string
  if (node.children) {
    for (const child of node.children) {
      if (isParagraph(child)) {
        for (const inner of child.children) {
          if (isText(inner)) {
            const candidate = inner.value.trim();
            if (/^https?:\/\//i.test(candidate)) return candidate;
          }
        }
      } else if (isText(child)) {
        const candidate = child.value.trim();
        if (/^https?:\/\//i.test(candidate)) return candidate;
      } else if (isDirective(child) && child.name === 'iframe') {
        const nested = child.label?.trim() ?? child.attributes?.src ?? child.attributes?.url;
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

// IFrame directive descriptor (treat as LEAF so following markdown isn't captured)
const IFrameDirectiveDescriptor: DirectiveDescriptor = {
  name: "iframe",
  testNode(node) {
    return node.name === "iframe";
  },
  attributes: ["src", "url"],
  hasChildren: false,
  Editor: (props) => {
    const mdastNode = props.mdastNode as DirectiveNode;
    // With hasChildren=false we expect leafDirective; still run extractor for safety
    const url = extractUrlFromDirective(mdastNode);

    if (!url) {
      return (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-left text-xs space-y-1">
          <p className="text-red-600 text-sm">IFrame: URL not detected</p>
          <p className="text-[10px] text-red-700/80">Use :iframe[https://...] syntax. (Containers auto-convert.)</p>
        </div>
      );
    }
    return <IFrame src={url} />;
  }
};

// Only import this to the next file
export default function InitializedMDXEditor({
  editorRef,
  ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
  return (
    <MDXEditor
      plugins={[
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        linkPlugin({
          validateUrl: (url) => {
            // More permissive URL validation to handle complex YouTube URLs
            try {
              // Allow relative URLs, fragments, and any valid URL
              if (url.startsWith("/") || url.startsWith("#")) return true;
              new URL(url); // This will throw if invalid
              return true;
            } catch {
              return false;
            }
          },
        }),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
        directivesPlugin({
          directiveDescriptors: [IFrameDirectiveDescriptor],
        }),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <Separator />
              <ListsToggle />
              <Separator />
              <BlockTypeSelect />
              <Separator />
              <CreateLink />
              <InsertTable />
            </>
          ),
        }),
      ]}
      {...props}
      ref={editorRef}
    />
  );
}
