import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, isMac } from '../../shared/components/WindowControls';

export function TopBar({ minimal = false }: { minimal?: boolean }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const openProject = useAppStore((s) => s.openProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const currentProject = useAppStore((s) => s.currentProject);
  const { t } = useI18n(resolvedLocale);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleOpen = async () => {
    if (window.orisonDesktop?.pickProjectDirectory) {
      const dir = await window.orisonDesktop.pickProjectDirectory();
      if (dir) openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir, type: 'script' });
    }
  };

  const actions: { icon: string; handler: () => void; disabled?: boolean }[][] = [
    [
      { icon: 'add', handler: () => setShowNewDialog(true) },
      { icon: 'folder_open', handler: handleOpen },
      { icon: 'save', handler: () => {}, disabled: true },
      { icon: 'ios_share', handler: () => {}, disabled: true },
    ],
    [
      { icon: 'undo', handler: () => {}, disabled: true },
      { icon: 'redo', handler: () => {}, disabled: true },
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
                  <button key={action.icon} className="workspace-action" type="button" aria-label={action.icon} onClick={action.handler} disabled={action.disabled} title={action.disabled ? 'Coming soon' : undefined}>
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
