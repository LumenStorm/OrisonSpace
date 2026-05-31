import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { htmlToMarkdown, markdownToHtml } from '../../shared/utils/markdown';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { FindReplace } from './FindReplace';
import { BubbleToolbar } from './file-editor/BubbleToolbar';

export type TiptapEditorFormat = 'html' | 'markdown';

type TiptapEditorProps = {
  content?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  format?: TiptapEditorFormat;
  flush?: boolean;
  extraContextItems?: ContextMenuItem[];
  bubbleMenu?: boolean;
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
  extraContextItems,
  bubbleMenu = false,
}: TiptapEditorProps) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const initialHtml = format === 'markdown' ? markdownToHtml(content) : content;
  const [showFind, setShowFind] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

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

  const handleFindClose = useCallback(() => setShowFind(false), []);

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable]);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const hasSelection = !editor.state.selection.empty;

  const ctxItems: ContextMenuItem[] = [
    { type: 'item', label: t('editor.cut'), icon: 'content_cut', disabled: !hasSelection, onClick: () => { document.execCommand('cut'); } },
    { type: 'item', label: t('editor.copy'), icon: 'content_copy', disabled: !hasSelection, onClick: () => { document.execCommand('copy'); } },
    { type: 'item', label: t('editor.paste'), icon: 'content_paste', onClick: () => { document.execCommand('paste'); } },
    { type: 'item', label: t('editor.selectAll'), icon: 'select_all', onClick: () => { editor.chain().focus().selectAll().run(); } },
    { type: 'separator' },
    { type: 'item', label: t('editor.bold'), icon: 'format_bold', onClick: () => { editor.chain().focus().toggleBold().run(); } },
    { type: 'item', label: t('editor.italic'), icon: 'format_italic', onClick: () => { editor.chain().focus().toggleItalic().run(); } },
    { type: 'item', label: t('editor.strikethrough'), icon: 'strikethrough_s', onClick: () => { editor.chain().focus().toggleStrike().run(); } },
    { type: 'separator' },
    { type: 'item', label: t('editor.heading', { level: '1' }), onClick: () => { editor.chain().focus().toggleHeading({ level: 1 }).run(); } },
    { type: 'item', label: t('editor.heading', { level: '2' }), onClick: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); } },
    { type: 'item', label: t('editor.heading', { level: '3' }), onClick: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); } },
    { type: 'separator' },
    { type: 'item', label: t('editor.bulletList'), icon: 'format_list_bulleted', onClick: () => { editor.chain().focus().toggleBulletList().run(); } },
    { type: 'item', label: t('editor.orderedList'), icon: 'format_list_numbered', onClick: () => { editor.chain().focus().toggleOrderedList().run(); } },
    { type: 'item', label: t('editor.quote'), icon: 'format_quote', onClick: () => { editor.chain().focus().toggleBlockquote().run(); } },
    { type: 'separator' },
    { type: 'item', label: t('editor.findReplace'), icon: 'find_replace', onClick: () => { setShowFind(true); } },
    ...(extraContextItems ?? []),
  ];

  return (
    <div className={`tiptap-wrapper${flush ? ' tiptap-wrapper--flush' : ''}`} onContextMenu={handleContextMenu}>
      {showFind && editor && <FindReplace editor={editor} onClose={handleFindClose} />}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={() => setCtxMenu(null)} />}
      {bubbleMenu && editable && <BubbleToolbar editor={editor} />}
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
