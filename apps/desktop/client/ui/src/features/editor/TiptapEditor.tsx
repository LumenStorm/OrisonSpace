import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { htmlToMarkdown, markdownToHtml } from '../../shared/utils/markdown';

export type TiptapEditorFormat = 'html' | 'markdown';

type TiptapEditorProps = {
  content?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  format?: TiptapEditorFormat;
};

const menuItems = [
  { command: 'toggleBold', activeName: 'bold', icon: 'format_bold', label: 'Bold' },
  { command: 'toggleItalic', activeName: 'italic', icon: 'format_italic', label: 'Italic' },
  { command: 'toggleStrike', activeName: 'strike', icon: 'strikethrough_s', label: 'Strikethrough' },
  { command: 'toggleCodeBlock', activeName: 'codeBlock', icon: 'code', label: 'Code Block' },
  { command: 'toggleBlockquote', activeName: 'blockquote', icon: 'format_quote', label: 'Quote' },
  { command: 'toggleBulletList', activeName: 'bulletList', icon: 'format_list_bulleted', label: 'Bullet List' },
  { command: 'toggleOrderedList', activeName: 'orderedList', icon: 'format_list_numbered', label: 'Ordered List' },
] as const;

type HeadingLevel = 1 | 2 | 3;

export function TiptapEditor({
  content = '',
  placeholder = 'Start writing...',
  onChange,
  editable = true,
  format = 'html',
}: TiptapEditorProps) {
  const initialHtml = format === 'markdown' ? markdownToHtml(content) : content;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    editable,
    onUpdate: ({ editor: e }) => {
      if (!onChange) return;
      const html = e.getHTML();
      onChange(format === 'markdown' ? htmlToMarkdown(html) : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editable !== editor.isEditable) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper">
      {editable && (
        <div className="tiptap-toolbar" role="toolbar" aria-label="Formatting">
          {([1, 2, 3] as HeadingLevel[]).map((level) => (
            <button
              key={`h${level}`}
              type="button"
              className={`tiptap-toolbar-btn${editor.isActive('heading', { level }) ? ' is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              title={`Heading ${level}`}
            >
              H{level}
            </button>
          ))}
          <span className="tiptap-toolbar-divider" />
          {menuItems.map((item) => (
            <button
              key={item.command}
              type="button"
              className={`tiptap-toolbar-btn${editor.isActive(item.activeName) ? ' is-active' : ''}`}
              onClick={() => (editor.chain().focus() as any)[item.command]().run()}
              title={item.label}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
}
