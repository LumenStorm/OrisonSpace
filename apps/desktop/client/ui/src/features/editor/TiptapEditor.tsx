import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { htmlToMarkdown, markdownToHtml } from '../../shared/utils/markdown';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { FindReplaceBar, type FindReplaceAdapter, type FindMatch, type FindReplaceMode } from './FindReplaceBar';
import { BubbleToolbar } from './file-editor/BubbleToolbar';

export type TiptapEditorFormat = 'html' | 'markdown';

export type SelectionInfo = { text: string; from: number; to: number };

type TiptapEditorProps = {
  content?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  format?: TiptapEditorFormat;
  flush?: boolean;
  extraContextItems?: ContextMenuItem[];
  bubbleMenu?: boolean;
  disableFind?: boolean;
  onSelectionAction?: (action: 'review' | 'attach' | 'continue' | 'polish', selection: SelectionInfo) => void;
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
  disableFind = false,
  onSelectionAction,
}: TiptapEditorProps) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const initialHtml = format === 'markdown' ? markdownToHtml(content) : content;
  const [findMode, setFindMode] = useState<FindReplaceMode | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  const handleFindClose = useCallback(() => setFindMode(null), []);

  useEffect(() => {
    if (!editable || disableFind) return;
    // Scope the find shortcut to THIS editor's wrapper. A window-level listener
    // made every mounted TiptapEditor (split view, outline) compete: the first
    // to register won via `defaultPrevented`, so Ctrl+F opened find in the wrong
    // pane regardless of focus. Listening on the wrapper means the shortcut only
    // fires for the editor the user is actually typing in.
    const el = wrapperRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'f') { e.preventDefault(); setFindMode('find'); }
      if (e.key === 'h') { e.preventDefault(); setFindMode('replace'); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [editable, disableFind]);

  useEffect(() => {
    if (!editor) return;
    if (editable !== editor.isEditable) editor.setEditable(editable);
  }, [editor, editable]);

  const findAdapter: FindReplaceAdapter = useMemo(() => {
    if (!editor) return { getText: () => '', highlight: () => {}, replaceOne: () => {}, replaceAll: () => {} };

    function buildPosMap() {
      const doc = editor!.state.doc;
      const chars: string[] = [];
      const positions: number[] = [];
      let needSep = false;
      doc.descendants((node, pos) => {
        if (node.isTextblock && needSep) {
          chars.push('\n');
          positions.push(pos);
          needSep = false;
        }
        if (node.isText) {
          for (let i = 0; i < node.text!.length; i++) {
            chars.push(node.text![i]);
            positions.push(pos + i);
          }
          needSep = true;
        }
      });
      return { text: chars.join(''), positions };
    }

    return {
      getText: () => buildPosMap().text,
      highlight: (match: FindMatch) => {
        const { positions } = buildPosMap();
        if (positions.length === 0) return;
        const from = positions[match.start] ?? 0;
        const to = match.end > 0 ? (positions[match.end - 1] ?? 0) + 1 : from;
        editor!.chain().setTextSelection({ from, to }).scrollIntoView().run();
      },
      replaceOne: (match: FindMatch, replacement: string) => {
        const { positions } = buildPosMap();
        if (positions.length === 0) return;
        const from = positions[match.start] ?? 0;
        const to = match.end > 0 ? (positions[match.end - 1] ?? 0) + 1 : from;
        editor!.chain().setTextSelection({ from, to }).deleteSelection().insertContent(replacement).run();
      },
      replaceAll: (matches: FindMatch[], replacement: string) => {
        for (let i = matches.length - 1; i >= 0; i--) {
          const { positions } = buildPosMap();
          if (positions.length === 0) return;
          const m = matches[i];
          const from = positions[m.start] ?? 0;
          const to = m.end > 0 ? (positions[m.end - 1] ?? 0) + 1 : from;
          editor!.chain().setTextSelection({ from, to }).deleteSelection().insertContent(replacement).run();
        }
      },
    };
  }, [editor]);

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
    { type: 'item', label: t('editor.findReplace'), icon: 'find_replace', onClick: () => { setFindMode('find'); } },
    ...(onSelectionAction ? [
      { type: 'separator' } as const,
      { type: 'item' as const, label: t('editor.aiReview'), icon: 'rate_review', disabled: !hasSelection, onClick: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        if (text) onSelectionAction('review', { text, from, to });
      }},
      { type: 'item' as const, label: t('editor.aiContinue'), icon: 'auto_fix_high', disabled: !hasSelection, onClick: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        if (text) onSelectionAction('continue', { text, from, to });
      }},
      { type: 'item' as const, label: t('editor.aiPolish'), icon: 'auto_awesome', disabled: !hasSelection, onClick: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        if (text) onSelectionAction('polish', { text, from, to });
      }},
      { type: 'item' as const, label: t('editor.addToAgent'), icon: 'attach_file', disabled: !hasSelection, onClick: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        if (text) onSelectionAction('attach', { text, from, to });
      }},
    ] : []),
    ...(extraContextItems ?? []),
  ];

  return (
    <div ref={wrapperRef} className={`tiptap-wrapper${flush ? ' tiptap-wrapper--flush' : ''}`} onContextMenu={handleContextMenu}>
      {!disableFind && findMode && <FindReplaceBar initialMode={findMode} adapter={findAdapter} onClose={handleFindClose} />}
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
