import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, isMac } from '../../shared/components/WindowControls';
import { ensureProjectRegistration } from '../../shared/api/projects';

export function TopBar({ minimal = false }: { minimal?: boolean }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const openProject = useAppStore((s) => s.openProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const currentProject = useAppStore((s) => s.currentProject);
  const token = useAppStore((s) => s.token);
  const saveProject = useAppStore((s) => s.saveProject);
  const saveChaptersToProject = useAppStore((s) => s.saveChaptersToProject);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoLen = useAppStore((s) => s.undoStack.length);
  const redoLen = useAppStore((s) => s.redoStack.length);
  const { t } = useI18n(resolvedLocale);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleOpen = async () => {
    const dir = await window.orisonDesktop?.pickProjectDirectory();
    if (!dir) return;
    const meta = await window.orisonDesktop?.loadProjectMeta(dir);

    const project = meta ? {
      projectId: typeof meta.projectId === 'string' ? meta.projectId : undefined,
      name: (meta.name as string) || dir.split(/[\\/]/).pop() || 'Project',
      path: dir,
      type: (meta.type as 'novel' | 'script') || 'script',
      coverImage: (meta.coverImage as string) || undefined,
    } : {
      name: dir.split(/[\\/]/).pop() || 'Project',
      path: dir,
      type: 'script' as const,
    };

    if (!project.projectId && token) {
      try {
        project.projectId = await ensureProjectRegistration({ token, project });
        await window.orisonDesktop?.saveProjectMeta(dir, {
          ...(meta ?? {}),
          name: project.name,
          type: project.type,
          coverImage: project.coverImage ?? null,
          projectId: project.projectId,
        });
      } catch {
        // Keep the local project open even when registration is temporarily unavailable.
      }
    }

    openProject(project);
  };

  const handleSave = useCallback(async () => {
    await saveProject();
    await saveChaptersToProject();
  }, [saveProject, saveChaptersToProject]);

  const handleUndo = useCallback(() => undo(), [undo]);
  const handleRedo = useCallback(() => redo(), [redo]);

  // 全局快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  const hasSavePath = !!currentProject?.path;

  const actions: { icon: string; handler: () => void; disabled?: boolean; title?: string }[][] = [
    [
      { icon: 'add', handler: () => setShowNewDialog(true), title: t('projects.newProject') },
      { icon: 'folder_open', handler: handleOpen, title: t('projects.openProject') },
      { icon: 'save', handler: handleSave, disabled: !hasSavePath, title: `${t('topbar.save')} (${isMac ? '⌘' : 'Ctrl+'}S)` },
      { icon: 'ios_share', handler: () => {}, disabled: true, title: t('topbar.export') },
    ],
    [
      { icon: 'undo', handler: handleUndo, disabled: undoLen === 0, title: `${t('topbar.undo')} (${isMac ? '⌘' : 'Ctrl+'}Z)` },
      { icon: 'redo', handler: handleRedo, disabled: redoLen === 0, title: `${t('topbar.redo')} (${isMac ? '⌘⇧' : 'Ctrl+Shift+'}Z)` },
    ],
  ];

  return (
    <>
      <header className="workspace-topbar">
        {isMac && <div className="topbar-traffic-light-spacer" />}

        <div className="workspace-brand">{t('welcome.brand')}</div>
        {!minimal && (
          <div className="workspace-actions" aria-label="Workspace Actions">
            {currentProject && (
              <>
                <button className="workspace-action" type="button" aria-label="Projects" onClick={closeProject}>
                  <span className="material-symbols-outlined">home</span>
                </button>
                <div className="workspace-divider" />
              </>
            )}
            {actions.map((group, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {group.map((action) => (
                  <button
                    key={action.icon}
                    className="workspace-action"
                    type="button"
                    aria-label={action.icon}
                    onClick={action.handler}
                    disabled={action.disabled}
                    title={action.title}
                  >
                    <span className="material-symbols-outlined">{action.icon}</span>
                  </button>
                ))}
                {index < actions.length - 1 ? <div className="workspace-divider" /> : null}
              </div>
            ))}
          </div>
        )}

        <WindowControls />
      </header>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}
    </>
  );
}
