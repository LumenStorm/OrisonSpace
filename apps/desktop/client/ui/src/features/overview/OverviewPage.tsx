import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useToastStore } from '../../shared/store/toastStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';
import { normalizePath } from '../../shared/utils/paths';
import { openWriting } from '../editor/openWriting';
import { gitIsRepo, gitLog, gitCreateNode, gitStatusCount } from '../../shared/api/git';
import type { GitCommitEntry } from '@orison/shared-contracts';
import type { z } from 'zod';
import type { outlineV2Schema, worldSettingSchema, assetCardSchema } from '@orison/shared-contracts';

type OutlineV2 = z.infer<typeof outlineV2Schema>;
type WorldSetting = z.infer<typeof worldSettingSchema>;
type AssetCard = z.infer<typeof assetCardSchema>;

const DEBOUNCE_MS = 500;

function relativeTime(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const mins = Math.floor((Date.now() - ts * 1000) / 60000);
  if (mins < 1) return t('timeline.timeJustNow');
  if (mins < 60) return t('timeline.timeMinutesAgo', { value: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('timeline.timeHoursAgo', { value: hrs });
  const days = Math.floor(hrs / 24);
  return t('timeline.timeDaysAgo', { value: days });
}

export function OverviewPage() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const project = useAppStore((s) => s.currentProject);
  const chapters = useAppStore((s) => s.novelChapters) as NovelChapterMeta[];
  const updateProjectMeta = useAppStore((s) => s.updateProjectMeta);
  const saveProject = useAppStore((s) => s.saveProject);
  const showToast = useToastStore((s) => s.showToast);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const setActiveSidebarPanel = useAppStore((s) => s.setActiveSidebarPanel);

  const outline = useAppStore((s) => s.creativeFields.outline) as OutlineV2 | undefined;
  const worldSetting = useAppStore((s) => s.creativeFields.world_setting) as WorldSetting | undefined;
  const assetCards = useAppStore((s) => s.creativeFields.asset_cards) as AssetCard[] | undefined;

  const [name, setName] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [versions, setVersions] = useState<GitCommitEntry[]>([]);
  const [coverBust, setCoverBust] = useState(0);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'warn' | 'error' | null>(null);
  const [healthHint, setHealthHint] = useState('');

  // Identity of the project we last hydrated local fields from. Used to
  // re-seed inputs only on a real project switch, not on our own meta writes.
  const hydratedPathRef = useRef<string | null>(null);
  // Gates the debounced flush so we never write back a value we merely loaded.
  const userEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hydrate local inputs from the project. Keyed on path so editing the name
  // (which updates the currentProject object in place, same path) does NOT
  // re-seed and fight the user's keystrokes.
  useEffect(() => {
    if (!project) return;
    if (hydratedPathRef.current === (project.path ?? null)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
    hydratedPathRef.current = project.path ?? null;
    userEditedRef.current = false;
    setName(project.name ?? '');
    setLogline(project.logline ?? '');
    setSynopsis(project.synopsis ?? '');
    setSnapshotLoading(false);
  }, [project]);

  const markEdited = () => {
    userEditedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!userEditedRef.current) return;
      userEditedRef.current = false;
      void saveProject();
    }, DEBOUNCE_MS);
  };

  // Flush any pending edit on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (userEditedRef.current) {
      userEditedRef.current = false;
      void saveProject();
    }
  }, [saveProject]);

  // Load recent version nodes for the activity feed. Best-effort: a project
  // with no repo simply shows an empty activity stream.
  const projectPath = project?.path;
  useEffect(() => {
    if (!projectPath) { setVersions([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        if (await gitIsRepo(projectPath)) {
          const log = await gitLog(projectPath, 4);
          if (!cancelled) setVersions(log);
        } else if (!cancelled) {
          setVersions([]);
        }
      } catch {
        if (!cancelled) setVersions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [projectPath]);

  // Project health check
  useEffect(() => {
    if (!projectPath) { setHealthStatus(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const isRepo = await gitIsRepo(projectPath);
        if (cancelled) return;
        if (!isRepo) {
          setHealthStatus('warn');
          setHealthHint(t('overview.healthNoRepo'));
          return;
        }
        const dirtyCount = await gitStatusCount(projectPath);
        if (cancelled) return;
        if (dirtyCount > 0) {
          setHealthStatus('warn');
          setHealthHint(t('overview.healthUnsaved', { count: dirtyCount }));
          return;
        }
        setHealthStatus('ok');
        setHealthHint(t('overview.healthOk'));
      } catch {
        if (!cancelled) {
          setHealthStatus('error');
          setHealthHint(t('overview.healthError'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [projectPath, versions, t]);

  // Snapshot handler
  const handleSnapshot = async () => {
    if (!projectPath || snapshotLoading) return;
    const capturedProjectPath = projectPath;
    const isCurrentProject = () => normalizePath(
      useAppStore.getState().currentProject?.path ?? '',
    ) === normalizePath(capturedProjectPath);
    setSnapshotLoading(true);
    try {
      const now = new Date();
      const msg = `snapshot: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      await gitCreateNode(capturedProjectPath, msg);
      if (!isCurrentProject()) return;
      const log = await gitLog(capturedProjectPath, 4);
      if (!isCurrentProject()) return;
      setVersions(log);
      showToast(t('overview.snapshotSuccess'), 'success');
    } catch (err) {
      if (!isCurrentProject()) return;
      const reason = err instanceof Error ? err.message : String(err);
      showToast(t('overview.snapshotFailed', { reason }), 'error');
    } finally {
      if (isCurrentProject()) setSnapshotLoading(false);
    }
  };

  // Stats
  const totalChapters = chapters.length;
  const projectWordCount = useAppStore((s) => s.projectWordCount);
  const refreshWordCount = useAppStore((s) => s.refreshWordCount);
  // Recompute word count when the chapter set changes (not just on mount), so
  // adding/editing chapters reflects without leaving and re-entering the page.
  useEffect(() => { void refreshWordCount(); }, [refreshWordCount, chapters.length]);
  const totalWords = projectWordCount;
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

  const hasActivity = versions.length > 0 || recentChapters.length > 0;

  // Open a chapter's manuscript file as a tab (the source of truth). Shared with
  // the side-nav writing entry via openWriting() so both drive one flow.
  const openChapter = (chapter?: NovelChapterMeta) => openWriting(chapter);

  // Pick a cover image, copy it into the project as cover.<ext>, and persist it
  // to the project meta — the same flow as project creation. The cover is a
  // first-class project field, not derived from the assets library.
  const handlePickCover = async () => {
    if (!projectPath) return;
    const capturedProjectPath = projectPath;
    const isCurrentProject = () => normalizePath(
      useAppStore.getState().currentProject?.path ?? '',
    ) === normalizePath(capturedProjectPath);
    const src = await window.orisonDesktop?.pickCoverImage();
    if (!src || !isCurrentProject()) return;
    const previousCover = project?.coverImage;
    const dest = await window.orisonDesktop.copyCoverImage(src, capturedProjectPath);
    if (!isCurrentProject()) return;
    updateProjectMeta({ coverImage: dest });
    try {
      await saveProject();
    } catch (err) {
      if (!isCurrentProject()) return;
      // The cover file was copied but the meta write failed (e.g. disk/permission).
      // Roll the in-memory pointer back so the UI doesn't show a cover that
      // vanishes on reload, and tell the user instead of failing silently.
      updateProjectMeta({ coverImage: previousCover });
      const reason = err instanceof Error ? err.message : String(err);
      showToast(t('creative.coverSaveFailed', { reason }), 'error');
      return;
    }
    if (!isCurrentProject()) return;
    // The destination path is stable (cover.<ext>); bump a cache-buster so the
    // <img> re-fetches when the file is replaced in place.
    setCoverBust((n) => n + 1);
  };

  const coverImage = project?.coverImage;

  return (
    <div className="overview-page">
      {/* ── Hero ── */}
      <section className="overview-hero">
        <div className={`overview-cover${coverImage ? '' : ' overview-cover--empty'}`}>
          {coverImage ? (
            <button
              type="button"
              className="overview-cover-set"
              onClick={() => { void handlePickCover(); }}
              title={t('overview.changeCover')}
            >
              <img className="overview-cover-img" src={`orison-file:///${coverImage}?v=${coverBust}`} alt="" />
              <span className="overview-cover-overlay">
                <span className="material-symbols-outlined">photo_camera</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="overview-cover-placeholder"
              onClick={() => { void handlePickCover(); }}
              title={t('overview.setCover')}
            >
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
          )}
        </div>
        <div className="overview-hero-body">
          <div className="overview-header-row">
            <input
              className="overview-name-input"
              placeholder={t('overview.projectName')}
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                setName(value);
                updateProjectMeta({ name: value || (project?.name ?? '') });
                markEdited();
              }}
            />
            {project?.type && (
              <span className="overview-type-badge">
                {project.type === 'novel' ? t('overview.typeNovel') : t('overview.typeScript')}
              </span>
            )}
          </div>
          <input
            className="overview-logline-input"
            placeholder={t('overview.loglinePlaceholder')}
            value={logline}
            onChange={(e) => {
              const value = e.target.value;
              setLogline(value);
              updateProjectMeta({ logline: value || undefined });
              markEdited();
            }}
          />
          <textarea
            className="overview-synopsis-input"
            placeholder={t('overview.synopsisPlaceholder')}
            value={synopsis}
            onChange={(e) => {
              const value = e.target.value;
              setSynopsis(value);
              updateProjectMeta({ synopsis: value || undefined });
              markEdited();
            }}
            rows={2}
          />
        </div>
      </section>

      {/* ── Quick actions ── */}
      <section className="overview-actions">
        <button type="button" className="overview-action overview-action--primary" onClick={() => { void openChapter(); }}>
          <span className="material-symbols-outlined">edit_note</span>
          {t('overview.continueWriting')}
        </button>
        <button type="button" className="overview-action" onClick={() => setActivePage('outline')}>
          <span className="material-symbols-outlined">account_tree</span>
          {t('overview.openOutline')}
        </button>
        <button type="button" className="overview-action" onClick={() => setActiveSidebarPanel('timeline')}>
          <span className="material-symbols-outlined">history</span>
          {t('overview.openTimeline')}
        </button>
        <button type="button" className="overview-action" onClick={() => { void handleSnapshot(); }} disabled={snapshotLoading}>
          <span className="material-symbols-outlined">save</span>
          {snapshotLoading ? t('overview.snapshotSaving') : t('overview.saveSnapshot')}
        </button>
      </section>

      {/* ── Compact stat strip ── */}
      <section className="overview-stat-strip">
        {healthStatus && (
          <div className={`overview-stat overview-health overview-health--${healthStatus}`} title={healthHint}>
            <span className="material-symbols-outlined">
              {healthStatus === 'ok' ? 'check_circle' : healthStatus === 'warn' ? 'warning' : 'error'}
            </span>
            <span className="overview-stat-label">{healthHint}</span>
          </div>
        )}
        <div className="overview-stat">
          <span className="material-symbols-outlined">menu_book</span>
          <span className="overview-stat-value">{totalChapters}</span>
          <span className="overview-stat-label">{t('overview.chapters')}</span>
        </div>
        <div className="overview-stat">
          <span className="material-symbols-outlined">text_fields</span>
          <span className="overview-stat-value">{totalWords.toLocaleString()}</span>
          <span className="overview-stat-label">{t('overview.words')}</span>
        </div>
        <div className="overview-stat">
          <span className="material-symbols-outlined">person</span>
          <span className="overview-stat-value">{characterCount}</span>
          <span className="overview-stat-label">{t('overview.characters')}</span>
        </div>
        <div className="overview-stat">
          <span className="material-symbols-outlined">location_on</span>
          <span className="overview-stat-value">{locationCount}</span>
          <span className="overview-stat-label">{t('overview.locations')}</span>
        </div>
      </section>

      {/* ── Segmented phase progress ── */}
      {phases.length > 0 && (
        <section className="overview-progress" onClick={() => setActivePage('outline')} role="button" tabIndex={0}>
          <div className="overview-progress-segments">
            {phases.map((p, i) => (
              <div
                key={p.id ?? i}
                className={`overview-progress-segment${i <= currentPhaseIndex ? ' is-done' : ''}${i === currentPhaseIndex ? ' is-current' : ''}`}
                title={p.title}
              />
            ))}
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

      {/* ── Bottom grid: activity feed + world summary ── */}
      <section className="overview-bottom-grid">
        <div className="overview-activity">
          <h3 className="overview-section-title">{t('overview.activity')}</h3>
          {hasActivity ? (
            <ul className="overview-activity-list">
              {versions.map((v) => (
                <li key={v.oid} className="overview-activity-item" onClick={() => setActiveSidebarPanel('timeline')} role="button" tabIndex={0}>
                  <span className="material-symbols-outlined overview-activity-icon">commit</span>
                  <span className="overview-activity-text">
                    {v.tag && <span className="overview-activity-tag">{v.tag}</span>}
                    {v.message.split('\n')[0]}
                  </span>
                  <span className="overview-activity-time">{relativeTime(v.timestamp, t)}</span>
                </li>
              ))}
              {recentChapters.map((ch) => (
                <li key={ch.id} className="overview-activity-item" onClick={() => { void openChapter(ch); }} role="button" tabIndex={0}>
                  <span className="material-symbols-outlined overview-activity-icon">description</span>
                  <span className="overview-activity-text">{ch.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty-hint">{t('overview.noActivity')}</p>
          )}
        </div>
        <div className="overview-world-summary">
          <h3 className="overview-section-title">{t('overview.worldSummary')}</h3>
          {worldSetting ? (
            <div className="overview-world-content">
              {worldSetting.era && <p className="overview-world-line">{t('overview.era')}: {worldSetting.era}</p>}
              {(worldSetting.rules?.length ?? 0) > 0 && (
                <p className="overview-world-line">{t('overview.rules')}: {worldSetting.rules.slice(0, 2).join('、')}</p>
              )}
              {(worldSetting.locations?.length ?? 0) > 0 && (
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
