import { type MDXEditorMethods, type MDXEditorProps } from "@mdxeditor/editor";
import { forwardRef } from "react";
import InitializedMDXEditor from "./InitializedMDXEditor";

export const ForwardRefEditor = forwardRef<MDXEditorMethods, MDXEditorProps>(
  (props, ref) => <InitializedMDXEditor {...props} editorRef={ref} />,
);

ForwardRefEditor.displayName = "ForwardRefEditor";
