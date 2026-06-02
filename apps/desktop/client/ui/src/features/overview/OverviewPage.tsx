import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';
import type { z } from 'zod';
import type { outlineV2Schema, worldSettingSchema, assetCardSchema } from '@orison/shared-contracts';

type OutlineV2 = z.infer<typeof outlineV2Schema>;
type WorldSetting = z.infer<typeof worldSettingSchema>;
type AssetCard = z.infer<typeof assetCardSchema>;

const DEBOUNCE_MS = 500;

export function OverviewPage() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const project = useAppStore((s) => s.currentProject);
  const chapters = useAppStore((s) => s.novelChapters) as NovelChapterMeta[];
  const setCurrentProject = useAppStore((s) => s.openProject);
  const saveProject = useAppStore((s) => s.saveProject);
  const setActivePage = useAppStore((s) => s.setActivePage);

  const outline = useAppStore((s) => s.creativeFields.outline) as OutlineV2 | undefined;
  const worldSetting = useAppStore((s) => s.creativeFields.world_setting) as WorldSetting | undefined;
  const assetCards = useAppStore((s) => s.creativeFields.asset_cards) as AssetCard[] | undefined;

  const [name, setName] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');

  const syncingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!project) return;
    syncingRef.current = true;
    setName(project.name ?? '');
    setLogline(project.logline ?? '');
    setSynopsis(project.synopsis ?? '');
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
      };
      setCurrentProject(updated);
      saveProject();
    }, DEBOUNCE_MS);
  }, [name, logline, synopsis, project, setCurrentProject, saveProject]);

  useEffect(() => {
    persist();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [persist]);

  // Stats
  const totalChapters = chapters.length;
  const totalWords = chapters.reduce(
    (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + (sec.wordCount ?? 0), 0), 0,
  );
  const characterCount = assetCards?.filter((c) => c.type === 'character').length ?? 0;
  const locationCount = worldSetting?.locations?.length ?? 0;

  // Phase progress
  const phases = outline?.phases ?? [];
  const currentPhaseIndex = (() => {
    if (phases.length === 0) return -1;
    const lastChapterOrder = chapters.length > 0
      ? Math.max(...chapters.map((c) => c.sortOrder))
      : 0;
    let acc = 0;
    for (let i = 0; i < phases.length; i++) {
      acc += phases[i].estimated_chapters ?? 0;
      if (lastChapterOrder <= acc) return i;
    }
    return phases.length - 1;
  })();

  // Recent chapters (last 3 by sort order)
  const recentChapters = [...chapters]
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .slice(0, 3);

  return (
    <div className="overview-page">
      {/* Header */}
      <section className="overview-header">
        <div className="overview-header-row">
          <input
            className="outline-title-input"
            placeholder={t('overview.projectName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {project?.type && (
            <span className="overview-type-badge">
              {project.type === 'novel' ? t('overview.typeNovel') : t('overview.typeScript')}
            </span>
          )}
        </div>
        <input
          className="outline-logline-input"
          placeholder={t('overview.loglinePlaceholder')}
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
        />
        <textarea
          className="outline-textarea"
          placeholder={t('overview.synopsisPlaceholder')}
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          rows={3}
        />
      </section>

      {/* Stats Cards */}
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
          <span className="overview-card-icon material-symbols-outlined">person</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{characterCount}</span>
            <span className="overview-card-label">{t('overview.characters')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">location_on</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{locationCount}</span>
            <span className="overview-card-label">{t('overview.locations')}</span>
          </div>
        </div>
      </section>

      {/* Phase Progress */}
      {phases.length > 0 && (
        <section className="overview-progress" onClick={() => setActivePage('outline')} role="button" tabIndex={0}>
          <div className="overview-progress-bar-track">
            <div
              className="overview-progress-bar-fill"
              style={{ width: `${((currentPhaseIndex + 1) / phases.length) * 100}%` }}
            />
          </div>
          <span className="overview-progress-label">
            {t('overview.phaseProgress', {
              current: currentPhaseIndex + 1,
              total: phases.length,
              name: phases[currentPhaseIndex]?.title ?? '',
            })}
          </span>
        </section>
      )}

      {/* Bottom Grid: Recent + World */}
      <section className="overview-bottom-grid">
        <div className="overview-recent">
          <h3 className="overview-section-title">{t('overview.recentEdits')}</h3>
          {recentChapters.length > 0 ? (
            <ul className="overview-recent-list">
              {recentChapters.map((ch) => (
                <li key={ch.id} className="overview-recent-item">
                  <span className="material-symbols-outlined overview-recent-icon">description</span>
                  <span className="overview-recent-title">{ch.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty-hint">{t('overview.noRecentEdits')}</p>
          )}
        </div>
        <div className="overview-world-summary">
          <h3 className="overview-section-title">{t('overview.worldSummary')}</h3>
          {worldSetting ? (
            <div className="overview-world-content">
              {worldSetting.era && <p className="overview-world-line">{t('overview.era')}: {worldSetting.era}</p>}
              {worldSetting.rules.length > 0 && (
                <p className="overview-world-line">{t('overview.rules')}: {worldSetting.rules.slice(0, 2).join('、')}</p>
              )}
              {worldSetting.locations.length > 0 && (
                <p className="overview-world-line">{t('overview.coreLocations')}: {worldSetting.locations.slice(0, 3).map((l) => l.name).join('、')}</p>
              )}
            </div>
          ) : (
            <p className="overview-empty-hint">{t('overview.noWorldSetting')}</p>
          )}
        </div>
      </section>
    </div>
  );
}
