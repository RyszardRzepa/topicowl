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
  GenericDirectiveEditor,
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

import { YouTube } from "@/components/YouTube";

// YouTube directive descriptor using the clean component
const YouTubeDirectiveDescriptor: DirectiveDescriptor = {
  name: "youtube",
  testNode(node) {
    return node.name === "youtube";
  },
  attributes: ["id"],
  hasChildren: false,
  Editor: (props) => {
    console.log("YouTube directive props:", props.mdastNode);
    const videoId = props.mdastNode.attributes?.id;
    if (!videoId) {
      return (
        <div className="rounded border border-gray-300 p-4 text-center text-gray-500">
          YouTube video (no ID provided)
        </div>
      );
    }

    console.log("Rendering YouTube with ID:", videoId);
    return <YouTube id={videoId} />;
  },
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
          directiveDescriptors: [YouTubeDirectiveDescriptor],
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
