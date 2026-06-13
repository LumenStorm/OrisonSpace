import { useCallback, useEffect, useState } from 'react';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';
import { useOpenProject } from '../../shared/hooks/useOpenProject';
import { ProjectCard } from '../../widgets/projects/ProjectCard';
import { ProjectsEmptyState } from '../../widgets/projects/ProjectsEmptyState';

export function ProjectsPage() {
  const {
    openProject,
    resolvedLocale,
    recentProjects,
    replaceRecentProjects,
  } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const handleOpen = useOpenProject();
  const hasRecent = recentProjects.length > 0;

  const refreshRecentProjects = useCallback(async () => {
    if (!window.orisonDesktop?.pathExists || refreshing) return;
    setRefreshing(true);
    try {
      // Source of truth = the ~/.orison SQLite registry (survives app version
      // changes / reinstalls). The localStorage list is only a first-paint
      // cache + a fallback for any rows missing from the registry.
      const registered = await listRegistered();
      const byPath = new Map<string, { projectId?: string; name: string; path: string; type: 'novel' | 'script'; coverImage?: string }>();
      // Registry first (already ordered by last-opened), then any localStorage-only entries.
      for (const r of registered) {
        byPath.set(r.path, { projectId: r.projectId, name: r.name, path: r.path, type: r.type, coverImage: r.coverImage });
      }
      for (const p of recentProjects) {
        if (!byPath.has(p.path)) byPath.set(p.path, p);
      }

      const next: typeof recentProjects = [];
      for (const project of byPath.values()) {
        const exists = await checkPathExists(project.path);
        if (exists === null) {
          next.push(project);
          continue;
        }
        if (!exists) continue;

        const meta = await safeLoadProjectMeta(project.path);
        let coverImage = typeof meta?.coverImage === 'string' ? meta.coverImage : project.coverImage;
        if (coverImage) {
          const coverExists = await checkPathExists(coverImage);
          if (!coverExists) coverImage = undefined;
        }

        next.push({
          projectId: typeof meta?.projectId === 'string' ? meta.projectId : project.projectId,
          name: typeof meta?.name === 'string' && meta.name.trim() ? meta.name : project.name,
          path: project.path,
          type: meta?.type === 'novel' || meta?.type === 'script' ? meta.type : project.type,
          coverImage,
        });
      }
      replaceRecentProjects(next);
    } finally {
      setRefreshing(false);
    }
  }, [recentProjects, refreshing, replaceRecentProjects]);

  useEffect(() => {
    void refreshRecentProjects();
    // Refresh once when the project page opens; the button handles explicit repeat scans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="projects-page">
      <div className="projects-header">
        <span className="projects-header-brand">{t('projects.brand')}</span>
      </div>

      <div className="projects-grid-container">
        {hasRecent ? (
          <>
            <div className="projects-section-header">
              <h2 className="projects-section-title">{t('projects.recentProjects')}</h2>
              <button
                type="button"
                className="projects-refresh-btn"
                onClick={() => void refreshRecentProjects()}
                disabled={refreshing}
              >
                <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                <span>{refreshing ? t('projects.refreshing') : t('projects.refresh')}</span>
              </button>
            </div>
            <div className="projects-grid">
              <button
                type="button"
                className="projects-grid-card projects-grid-card-new"
                onClick={() => setShowNew(true)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
                <span>{t('projects.newProject')}</span>
              </button>

              <button
                type="button"
                className="projects-grid-card projects-grid-card-new"
                onClick={handleOpen}
              >
                <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
                <span>{t('projects.openProject')}</span>
              </button>

              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.path}
                  project={project}
                  typeLabel={project.type === 'novel' ? t('projects.typeNovel') : t('projects.typeScript')}
                  onOpen={openProject}
                />
              ))}
            </div>
          </>
        ) : (
          <ProjectsEmptyState
            title={t('projects.emptyTitle')}
            hint={t('projects.emptyHint')}
            newLabel={t('projects.newProject')}
            openLabel={t('projects.openProject')}
            onNew={() => setShowNew(true)}
            onOpen={handleOpen}
          />
        )}
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

async function checkPathExists(path: string): Promise<boolean | null> {
  try {
    return await window.orisonDesktop.pathExists(path);
  } catch {
    return null;
  }
}

async function listRegistered(): Promise<Array<{ projectId: string; name: string; path: string; type: 'novel' | 'script'; coverImage?: string }>> {
  try {
    if (!window.orisonDesktop?.listRegisteredProjects) return [];
    const rows = await window.orisonDesktop.listRegisteredProjects();
    return rows.map((r) => ({ projectId: r.projectId, name: r.name, path: r.path, type: r.type, coverImage: r.coverImage }));
  } catch {
    return [];
  }
}

async function safeLoadProjectMeta(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await window.orisonDesktop.loadProjectMeta(path);
  } catch {
    return null;
  }
}
