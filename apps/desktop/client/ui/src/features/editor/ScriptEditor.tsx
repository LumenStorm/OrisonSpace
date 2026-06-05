import { useMemo, useCallback } from 'react';
import { TiptapEditor, type SelectionInfo } from './TiptapEditor';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import type { ContextMenuItem } from '../../shared/components/ContextMenu';
import type { SelectionAttachment } from '../../shared/types/attachment';
import { randomUUID } from '../../shared/util/id';

export function ScriptEditor() {
  const { resolvedLocale, chapters, activeChapterId, updateChapter, addChapter, addAttachment, setAgentPanelOpen, sendAgentMessage } = useAppStore(
    useShallow((s) => ({
      resolvedLocale: s.resolvedLocale,
      chapters: s.chapters,
      activeChapterId: s.activeChapterId,
      updateChapter: s.updateChapter,
      addChapter: s.addChapter,
      addAttachment: s.addAttachment,
      setAgentPanelOpen: s.setAgentPanelOpen,
      sendAgentMessage: s.sendAgentMessage,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  const extraContextItems: ContextMenuItem[] = useMemo(() => [
    { type: 'separator' },
    { type: 'item', label: t('editor.aiContinue'), icon: 'auto_fix_high', disabled: true, onClick: () => {} },
    { type: 'item', label: t('editor.aiPolish'), icon: 'auto_awesome', disabled: true, onClick: () => {} },
  ], [t]);

  const handleSelectionAction = useCallback((action: 'review' | 'attach', sel: SelectionInfo) => {
    if (!activeChapter) return;
    const content = activeChapter.content;
    const prefix = content.slice(Math.max(0, sel.from - 50), sel.from);
    const suffix = content.slice(sel.to, sel.to + 50);
    const att: SelectionAttachment = {
      type: 'selection',
      id: randomUUID(),
      label: sel.text.slice(0, 20) + (sel.text.length > 20 ? '…' : ''),
      text: sel.text,
      sourceType: 'chapter',
      chapterId: activeChapter.id,
      anchor: { quote: sel.text, prefix, suffix, rangeHint: { from: sel.from, to: sel.to } },
    };
    addAttachment(att);
    setAgentPanelOpen(true);
    if (action === 'review') {
      void sendAgentMessage('请评阅以下选段');
    }
  }, [activeChapter, addAttachment, setAgentPanelOpen, sendAgentMessage]);

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
        onSelectionAction={handleSelectionAction}
      />
    </div>
  );
}
