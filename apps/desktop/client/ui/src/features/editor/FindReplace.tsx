import { useState, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Props = {
  editor: Editor;
  onClose: () => void;
};

export function FindReplace({ editor, onClose }: Props) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  const highlight = useCallback(() => {
    if (!find) { setMatchCount(0); return; }
    const text = editor.getText();
    const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    setMatchCount(matches?.length ?? 0);
  }, [editor, find]);

  useEffect(() => { highlight(); }, [highlight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleReplace = () => {
    if (!find) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === find.toLowerCase()) {
      editor.chain().focus().deleteSelection().insertContent(replace).run();
      highlight();
    }
  };

  const handleReplaceAll = () => {
    if (!find) return;
    const html = editor.getHTML();
    const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editor.commands.setContent(html.replace(regex, replace), { emitUpdate: true });
    highlight();
  };

  return (
    <div className="find-replace-bar">
      <input
        className="find-replace-input"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        placeholder={t('editor.find') || 'Find'}
        autoFocus
      />
      <span className="find-replace-count">{matchCount}</span>
      <input
        className="find-replace-input"
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        placeholder={t('editor.replace') || 'Replace'}
      />
      <button type="button" className="find-replace-btn" onClick={handleReplace}>{t('editor.replaceOne') || 'Replace'}</button>
      <button type="button" className="find-replace-btn" onClick={handleReplaceAll}>{t('editor.replaceAll') || 'All'}</button>
      <button type="button" className="find-replace-btn" onClick={onClose} aria-label="Close">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}
