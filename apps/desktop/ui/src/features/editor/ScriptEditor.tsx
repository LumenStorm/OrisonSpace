import { useState } from 'react';
import { TiptapEditor } from './TiptapEditor';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Chapter = {
  id: string;
  title: string;
  content: string;
};

export function ScriptEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const [chapters, setChapters] = useState<Chapter[]>([
    { id: 'ch-1', title: t('script.chapterDefault', { n: '1' }), content: '' },
  ]);
  const [activeId, setActiveId] = useState('ch-1');

  const activeChapter = chapters.find((c) => c.id === activeId);

  const addChapter = () => {
    const id = `ch-${Date.now()}`;
    const newChapter = { id, title: t('script.chapterDefault', { n: String(chapters.length + 1) }), content: '' };
    setChapters([...chapters, newChapter]);
    setActiveId(id);
  };

  const updateChapter = (id: string, patch: Partial<Chapter>) => {
    setChapters(chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <div className="script-editor">
      <aside className="script-sidebar">
        <div className="script-sidebar-header">
          <h3 className="script-sidebar-title">{t('script.chapters')}</h3>
          <button type="button" className="outline-add-btn" onClick={addChapter}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
        </div>
        <div className="script-chapter-list">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`script-chapter-item${ch.id === activeId ? ' is-active' : ''}`}
              onClick={() => setActiveId(ch.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">article</span>
              <input
                className="script-chapter-name"
                value={ch.title}
                onChange={(e) => updateChapter(ch.id, { title: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </button>
          ))}
        </div>
      </aside>
      <div className="script-main">
        {activeChapter ? (
          <TiptapEditor
            key={activeChapter.id}
            content={activeChapter.content}
            placeholder={t('script.startWriting')}
            onChange={(html) => updateChapter(activeChapter.id, { content: html })}
          />
        ) : (
          <div className="editor-placeholder">
            <span className="material-symbols-outlined" aria-hidden="true">description</span>
            <p>{t('script.selectChapter')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
