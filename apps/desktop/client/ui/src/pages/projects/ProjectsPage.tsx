import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectLifecycleError, RegisteredProject } from '@orison/shared-contracts';
import { deleteProject, duplicateProject, renameProject } from '../../shared/api/projects';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore, type ProjectMeta } from '../../shared/store/appStore';
import { useConfirmStore } from '../../shared/store/confirmStore';
import { useToastStore } from '../../shared/store/toastStore';
import { useOpenProject } from '../../shared/hooks/useOpenProject';
import { ProjectCard } from '../../widgets/projects/ProjectCard';
import { ProjectNameDialog } from '../../widgets/projects/ProjectNameDialog';
import { ProjectsEmptyState } from '../../widgets/projects/ProjectsEmptyState';

type ProjectContextMenu = { project: ProjectMeta; x: number; y: number };
type ProjectNameAction = { mode: 'duplicate' | 'rename'; project: ProjectMeta };

export function ProjectsPage() {
  const {
    openProject,
    resolvedLocale,
    recentProjects,
    addRecentProject,
    removeRecentProject,
    replaceRecentProjects,
  } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const requestConfirm = useConfirmStore((state) => state.requestConfirm);
  const showToast = useToastStore((state) => state.showToast);
  const [showNew, setShowNew] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ProjectContextMenu | null>(null);
  const [nameAction, setNameAction] = useState<ProjectNameAction | null>(null);
  const [mutatingPath, setMutatingPath] = useState<string | null>(null);
  const refreshVersionRef = useRef(0);
  const handleOpen = useOpenProject();
  const hasRecent = recentProjects.length > 0;

  const refreshRecentProjects = useCallback(async () => {
    if (!window.orisonDesktop?.pathExists || refreshing || mutatingPath) return;
    const refreshVersion = ++refreshVersionRef.current;
    setRefreshing(true);
    try {
      // Source of truth = the ~/.orison SQLite registry (survives app version
      // changes / reinstalls). The localStorage list is only a first-paint
      // cache + a fallback for any rows missing from the registry.
      const registered = await listRegistered();
      const byPath = new Map<string, { projectId?: string; name: string; path: string; type: 'novel' | 'script'; coverImage?: string }>();
      // 注册表可用时只信任已通过主进程身份校验的记录；不可用时才回退到本地缓存。
      for (const r of registered.projects) {
        byPath.set(r.path, { projectId: r.projectId, name: r.name, path: r.path, type: r.type, coverImage: r.coverImage });
      }
      if (!registered.available) {
        for (const p of recentProjects) {
          if (!byPath.has(p.path)) byPath.set(p.path, p);
        }
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
      if (refreshVersion === refreshVersionRef.current) replaceRecentProjects(next);
    } finally {
      if (refreshVersion === refreshVersionRef.current) setRefreshing(false);
    }
  }, [mutatingPath, recentProjects, refreshing, replaceRecentProjects]);

  const invalidateRefresh = useCallback(() => {
    refreshVersionRef.current += 1;
    setRefreshing(false);
  }, []);

  const handleNameSubmit = useCallback(async (name: string): Promise<string | null> => {
    if (!nameAction) return t('projects.operationFailed');
    const { mode, project } = nameAction;
    setMutatingPath(project.path);
    try {
      const result = mode === 'duplicate'
        ? await duplicateProject(project.path, name)
        : await renameProject(project.path, name);
      if (!result.ok) return getProjectOperationError(result.error, mode, t);
      if (!result.project) return t('projects.operationFailed');

      invalidateRefresh();
      addRecentProject(toProjectMeta(result.project));
      showToast(
        mode === 'duplicate'
          ? t('projects.duplicateSuccess', { name: result.project.name })
          : t('projects.renameSuccess', { name: result.project.name }),
        'success',
      );
      return null;
    } catch {
      return t('projects.operationFailed');
    } finally {
      setMutatingPath(null);
    }
  }, [addRecentProject, invalidateRefresh, nameAction, showToast, t]);

  const handleDelete = useCallback(async (project: ProjectMeta) => {
    const confirmed = await requestConfirm({
      title: t('projects.deleteProject'),
      message: t('projects.deleteConfirm', { name: project.name }),
      confirmLabel: t('projects.deleteProject'),
      cancelLabel: t('projects.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    setMutatingPath(project.path);
    try {
      const result = await deleteProject(project.path);
      if (!result.ok) {
        showToast(getProjectOperationError(result.error, 'delete', t), 'error');
        return;
      }
      invalidateRefresh();
      removeRecentProject(project.path);
      showToast(t('projects.deleteSuccess', { name: project.name }), 'success');
    } catch {
      showToast(t('projects.operationFailed'), 'error');
    } finally {
      setMutatingPath(null);
    }
  }, [invalidateRefresh, removeRecentProject, requestConfirm, showToast, t]);

  const contextMenuItems: ContextMenuItem[] = contextMenu ? [
    {
      type: 'item',
      label: t('projects.duplicateProject'),
      icon: 'content_copy',
      disabled: Boolean(mutatingPath),
      onClick: () => setNameAction({ mode: 'duplicate', project: contextMenu.project }),
    },
    {
      type: 'item',
      label: t('projects.renameProject'),
      icon: 'edit',
      disabled: Boolean(mutatingPath),
      onClick: () => setNameAction({ mode: 'rename', project: contextMenu.project }),
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('projects.deleteProject'),
      icon: 'delete',
      danger: true,
      disabled: Boolean(mutatingPath),
      onClick: () => void handleDelete(contextMenu.project),
    },
  ] : [];

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
                disabled={refreshing || Boolean(mutatingPath)}
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
                  onMenuRequest={(selectedProject, x, y) => setContextMenu({ project: selectedProject, x, y })}
                  contextActive={contextMenu?.project.path === project.path}
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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {nameAction && (
        <ProjectNameDialog
          key={`${nameAction.mode}:${nameAction.project.path}`}
          title={nameAction.mode === 'duplicate' ? t('projects.duplicateProject') : t('projects.renameProject')}
          label={nameAction.mode === 'duplicate' ? t('projects.duplicateName') : t('projects.projectName')}
          initialName={nameAction.mode === 'duplicate'
            ? t('projects.duplicateNameDefault', { name: nameAction.project.name })
            : nameAction.project.name}
          confirmLabel={nameAction.mode === 'duplicate' ? t('projects.duplicate') : t('projects.rename')}
          busyLabel={nameAction.mode === 'duplicate' ? t('projects.duplicating') : t('projects.renaming')}
          cancelLabel={t('projects.cancel')}
          onSubmit={handleNameSubmit}
          onClose={() => setNameAction(null)}
        />
      )}
    </div>
  );
}

function toProjectMeta(project: RegisteredProject): ProjectMeta {
  return {
    projectId: project.projectId,
    name: project.name,
    path: project.path,
    type: project.type,
    coverImage: project.coverImage,
  };
}

function getProjectOperationError(
  error: ProjectLifecycleError,
  action: 'duplicate' | 'rename' | 'delete',
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (error === 'invalid-name') return t('projects.invalidName');
  if (error === 'name-exists') return t('projects.nameExists');
  if (error === 'not-found') return t('projects.projectNotFound');
  if (error === 'protected-path') return t('projects.protectedPath');
  if (action === 'duplicate') return t('projects.duplicateFailed');
  if (action === 'rename') return t('projects.renameFailed');
  return t('projects.deleteFailed');
}

async function checkPathExists(path: string): Promise<boolean | null> {
  try {
    return await window.orisonDesktop.pathExists(path);
  } catch {
    return null;
  }
}

async function listRegistered(): Promise<{
  available: boolean;
  projects: Array<{ projectId: string; name: string; path: string; type: 'novel' | 'script'; coverImage?: string }>;
}> {
  try {
    if (!window.orisonDesktop?.listRegisteredProjects) return { available: false, projects: [] };
    const rows = await window.orisonDesktop.listRegisteredProjects();
    return {
      available: true,
      projects: rows.map((r) => ({ projectId: r.projectId, name: r.name, path: r.path, type: r.type, coverImage: r.coverImage })),
    };
  } catch {
    return { available: false, projects: [] };
  }
}

async function safeLoadProjectMeta(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await window.orisonDesktop.loadProjectMeta(path);
  } catch {
    return null;
  }
}
