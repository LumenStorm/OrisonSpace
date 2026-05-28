import { useMemo } from 'react';
import { TiptapEditor } from './TiptapEditor';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import type { ContextMenuItem } from '../../shared/components/ContextMenu';

export function ScriptEditor() {
  const { resolvedLocale, chapters, activeChapterId, updateChapter, addChapter } = useAppStore(
    useShallow((s) => ({
      resolvedLocale: s.resolvedLocale,
      chapters: s.chapters,
      activeChapterId: s.activeChapterId,
      updateChapter: s.updateChapter,
      addChapter: s.addChapter,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  const extraContextItems: ContextMenuItem[] = useMemo(() => [
    { type: 'separator' },
    { type: 'item', label: t('editor.aiContinue'), icon: 'auto_fix_high', disabled: true, onClick: () => {} },
    { type: 'item', label: t('editor.aiPolish'), icon: 'auto_awesome', disabled: true, onClick: () => {} },
  ], [t]);

  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  if (!activeChapter) {
    return (
      <div className="editor-placeholder">
        <span className="material-symbols-outlined" aria-hidden="true">description</span>
        <p>{t('script.selectChapter')}</p>
        <button type="button" className="outline-add-btn" onClick={() => addChapter()}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          {t('script.addChapter')}
        </button>
      </div>
    );
  }

  return (
    <div className="script-editor script-editor-pure">
      <TiptapEditor
        key={activeChapter.id}
        content={activeChapter.content}
        placeholder={t('script.startWriting')}
        onChange={(html) => updateChapter(activeChapter.id, { content: html })}
        flush
        extraContextItems={extraContextItems}
      />
    </div>
  );
}
