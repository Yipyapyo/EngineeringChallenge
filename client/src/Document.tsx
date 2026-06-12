import { Editor, EditorContent } from "@tiptap/react";

export interface DocumentProps {
  editor: Editor | null;
}

export default function Document({ editor }: DocumentProps) {
  return (
    <div className="w-full h-full overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  );
}
