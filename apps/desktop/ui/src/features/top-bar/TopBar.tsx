import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, isMac } from '../../shared/components/WindowControls';
import { Tooltip } from '../../shared/components/Tooltip';

export function TopBar({ minimal = false }: { minimal?: boolean }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const openProject = useAppStore((s) => s.openProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const currentProject = useAppStore((s) => s.currentProject);
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
    if (meta) {
      openProject({
        name: (meta.name as string) || dir.split(/[\\/]/).pop() || 'Project',
        path: dir,
        type: (meta.type as 'novel' | 'script') || 'script',
        coverImage: (meta.coverImage as string) || undefined,
      });
    } else {
      openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir, type: 'script' });
    }
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

  const actions: { icon: string; handler: () => void; disabled?: boolean; label: string }[][] = [
    [
      { icon: 'add', handler: () => setShowNewDialog(true), label: t('projects.newProject') },
      { icon: 'folder_open', handler: handleOpen, label: t('projects.openProject') },
      { icon: 'save', handler: handleSave, disabled: !hasSavePath, label: `${t('topbar.save')} (${isMac ? '⌘' : 'Ctrl+'}S)` },
      { icon: 'ios_share', handler: () => {}, disabled: true, label: t('topbar.export') },
    ],
    [
      { icon: 'undo', handler: handleUndo, disabled: undoLen === 0, label: `${t('topbar.undo')} (${isMac ? '⌘' : 'Ctrl+'}Z)` },
      { icon: 'redo', handler: handleRedo, disabled: redoLen === 0, label: `${t('topbar.redo')} (${isMac ? '⌘⇧' : 'Ctrl+Shift+'}Z)` },
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
                <Tooltip label={t('projects.brand')} placement="bottom">
                  <button className="workspace-action" type="button" aria-label="Projects" onClick={closeProject}>
                    <span className="material-symbols-outlined">home</span>
                  </button>
                </Tooltip>
                <div className="workspace-divider" />
              </>
            )}
            {actions.map((group, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {group.map((action) => (
                  <Tooltip key={action.icon} label={action.label} placement="bottom">
                    <button
                      className="workspace-action"
                      type="button"
                      aria-label={action.label}
                      onClick={action.handler}
                      disabled={action.disabled}
                    >
                      <span className="material-symbols-outlined">{action.icon}</span>
                    </button>
                  </Tooltip>
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
