import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { htmlToMarkdown, markdownToHtml } from '../../shared/utils/markdown';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export type TiptapEditorFormat = 'html' | 'markdown';

type TiptapEditorProps = {
  content?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  format?: TiptapEditorFormat;
  flush?: boolean;
};

const menuItems = [
  { command: 'toggleBold', activeName: 'bold', icon: 'format_bold', i18nKey: 'editor.bold' },
  { command: 'toggleItalic', activeName: 'italic', icon: 'format_italic', i18nKey: 'editor.italic' },
  { command: 'toggleStrike', activeName: 'strike', icon: 'strikethrough_s', i18nKey: 'editor.strikethrough' },
  { command: 'toggleCodeBlock', activeName: 'codeBlock', icon: 'code', i18nKey: 'editor.codeBlock' },
  { command: 'toggleBlockquote', activeName: 'blockquote', icon: 'format_quote', i18nKey: 'editor.quote' },
  { command: 'toggleBulletList', activeName: 'bulletList', icon: 'format_list_bulleted', i18nKey: 'editor.bulletList' },
  { command: 'toggleOrderedList', activeName: 'orderedList', icon: 'format_list_numbered', i18nKey: 'editor.orderedList' },
] as const;

type HeadingLevel = 1 | 2 | 3;

export function TiptapEditor({
  content = '',
  placeholder = '',
  onChange,
  editable = true,
  format = 'html',
  flush = false,
}: TiptapEditorProps) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const initialHtml = format === 'markdown' ? markdownToHtml(content) : content;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || t('editor.startWriting') }),
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

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const newHtml = format === 'markdown' ? markdownToHtml(content) : content;
    if (editor.getHTML() !== newHtml) {
      editor.commands.setContent(newHtml, { emitUpdate: false });
    }
  }, [editor, content, format]);

  if (!editor) return null;

  return (
    <div className={`tiptap-wrapper${flush ? ' tiptap-wrapper--flush' : ''}`}>
      {editable && (
        <div className="tiptap-toolbar" role="toolbar" aria-label="Formatting">
          {([1, 2, 3] as HeadingLevel[]).map((level) => (
            <button
              key={`h${level}`}
              type="button"
              className={`tiptap-toolbar-btn${editor.isActive('heading', { level }) ? ' is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              title={t('editor.heading', { level: String(level) })}
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
              title={t(item.i18nKey)}
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
