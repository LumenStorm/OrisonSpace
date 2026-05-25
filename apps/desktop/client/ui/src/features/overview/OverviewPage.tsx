import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';

const DEBOUNCE_MS = 500;

export function OverviewPage() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const project = useAppStore((s) => s.currentProject);
  const chapters = useAppStore((s) => s.novelChapters) as NovelChapterMeta[];
  const setCurrentProject = useAppStore((s) => s.openProject);
  const saveProject = useAppStore((s) => s.saveProject);

  const [name, setName] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [theme, setTheme] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [tone, setTone] = useState('');

  const syncingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!project) return;
    syncingRef.current = true;
    setName(project.name ?? '');
    setLogline(project.logline ?? '');
    setSynopsis(project.synopsis ?? '');
    setGenre(project.genre ?? '');
    setTheme(project.theme ?? '');
    setWritingStyle(project.writingStyle ?? '');
    setTone(project.tone ?? '');
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [project]);

  const persist = useCallback(() => {
    if (syncingRef.current || !project) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const updated = {
        ...project,
        name: name || project.name,
        logline: logline || undefined,
        synopsis: synopsis || undefined,
        genre: genre || undefined,
        theme: theme || undefined,
        writingStyle: writingStyle || undefined,
        tone: tone || undefined,
      };
      setCurrentProject(updated);
      saveProject();
    }, DEBOUNCE_MS);
  }, [name, logline, synopsis, genre, theme, writingStyle, tone, project, setCurrentProject, saveProject]);

  useEffect(() => {
    persist();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [persist]);

  const totalChapters = chapters.length;
  const totalWords = chapters.reduce(
    (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + (sec.wordCount ?? 0), 0),
    0,
  );
  const draftCount = chapters.filter((c) => c.status === 'draft').length;
  const finalCount = chapters.filter((c) => c.status === 'final').length;

  return (
    <div className="overview-page">
      <section className="overview-meta-form">
        <div className="outline-field">
          <input
            className="outline-title-input"
            placeholder={t('overview.projectName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="outline-field">
          <label className="outline-field-label">{t('overview.logline')}</label>
          <input
            className="outline-style-input"
            placeholder={t('overview.loglinePlaceholder')}
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
          />
        </div>
        <div className="outline-field">
          <label className="outline-field-label">{t('overview.synopsis')}</label>
          <textarea
            className="outline-textarea"
            placeholder={t('overview.synopsisPlaceholder')}
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={4}
          />
        </div>
        <div className="outline-style-grid">
          <div className="outline-style-field">
            <label className="outline-style-label">{t('overview.genre')}</label>
            <input
              className="outline-style-input"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
          <div className="outline-style-field">
            <label className="outline-style-label">{t('overview.theme')}</label>
            <input
              className="outline-style-input"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>
        </div>
        <div className="outline-style-grid">
          <div className="outline-style-field">
            <label className="outline-style-label">{t('overview.writingStyle')}</label>
            <input
              className="outline-style-input"
              value={writingStyle}
              onChange={(e) => setWritingStyle(e.target.value)}
            />
          </div>
          <div className="outline-style-field">
            <label className="outline-style-label">{t('overview.tone')}</label>
            <input
              className="outline-style-input"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="overview-cards">
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">menu_book</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{totalChapters}</span>
            <span className="overview-card-label">{t('overview.chapters')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">text_fields</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{totalWords.toLocaleString()}</span>
            <span className="overview-card-label">{t('overview.words')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">edit_note</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{draftCount}</span>
            <span className="overview-card-label">{t('overview.drafts')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">check_circle</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{finalCount}</span>
            <span className="overview-card-label">{t('overview.final')}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
