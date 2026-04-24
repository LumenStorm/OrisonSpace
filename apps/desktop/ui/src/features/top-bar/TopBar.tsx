import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const isMac = window.orisonDesktop?.platform === 'darwin';

export function TopBar({ minimal = false }: { minimal?: boolean }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const openProject = useAppStore((s) => s.openProject);
  const { t } = useI18n(resolvedLocale);
  const [maximized, setMaximized] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'novel' | 'script'>('novel');

  useEffect(() => {
    window.orisonDesktop?.isMaximized?.().then(setMaximized);
  }, []);

  const handleMinimize = useCallback(() => window.orisonDesktop?.minimize(), []);
  const handleMaximize = useCallback(() => {
    window.orisonDesktop?.maximize();
    setMaximized((v) => !v);
  }, []);
  const handleClose = useCallback(() => window.orisonDesktop?.close(), []);

  const handleNew = () => setShowNewDialog(true);
  const handleCreate = () => {
    if (!newName.trim()) return;
    openProject({ name: newName.trim(), path: '', type: newType });
    setNewName('');
    setNewType('novel');
    setShowNewDialog(false);
  };
  const handleOpen = async () => {
    if (window.orisonDesktop?.pickProjectDirectory) {
      const dir = await window.orisonDesktop.pickProjectDirectory();
      if (dir) openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir, type: 'script' });
    }
  };
  const handleSave = () => console.log('save');
  const handleExport = () => console.log('export');
  const handleUndo = () => console.log('undo');
  const handleRedo = () => console.log('redo');

  const actions: { icon: string; handler: () => void }[][] = [
    [
      { icon: 'add', handler: handleNew },
      { icon: 'folder_open', handler: handleOpen },
      { icon: 'save', handler: handleSave },
      { icon: 'ios_share', handler: handleExport },
    ],
    [
      { icon: 'undo', handler: handleUndo },
      { icon: 'redo', handler: handleRedo },
    ],
  ];

  return (
    <>
      <header className="workspace-topbar">
        {isMac && <div className="topbar-traffic-light-spacer" />}

        <div className="workspace-brand">{t('welcome.brand')}</div>
        {!minimal && (
          <div className="workspace-actions" aria-label="Workspace Actions">
            {actions.map((group, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {group.map((action) => (
                  <button key={action.icon} className="workspace-action" type="button" aria-label={action.icon} onClick={action.handler}>
                    <span className="material-symbols-outlined">{action.icon}</span>
                  </button>
                ))}
                {index < actions.length - 1 ? <div className="workspace-divider" /> : null}
              </div>
            ))}
          </div>
        )}

        {!isMac && (
          <div className="window-controls">
            <button type="button" className="window-control" aria-label="Minimize" onClick={handleMinimize}>
              <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
            </button>
            <button type="button" className="window-control" aria-label="Maximize" onClick={handleMaximize}>
              {maximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="2" y="0" width="8" height="8" rx="0.5" />
                  <rect x="0" y="2" width="8" height="8" rx="0.5" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
                </svg>
              )}
            </button>
            <button type="button" className="window-control window-control-close" aria-label="Close" onClick={handleClose}>
              <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
                <line x1="0" y1="0" x2="10" y2="10" />
                <line x1="10" y1="0" x2="0" y2="10" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {showNewDialog && (
        <div className="topbar-new-dialog-overlay" onClick={() => setShowNewDialog(false)}>
          <div className="topbar-new-dialog" onClick={(e) => e.stopPropagation()}>
            <input
              className="auth-input"
              type="text"
              placeholder={t('projects.projectName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="projects-type-selector">
              <span className="sidebar-settings-label">{t('projects.projectType')}</span>
              <div className="sidebar-settings-options">
                <button
                  type="button"
                  className={`sidebar-settings-option${newType === 'novel' ? ' is-active' : ''}`}
                  onClick={() => setNewType('novel')}
                >
                  {t('projects.typeNovel')}
                </button>
                <button
                  type="button"
                  className={`sidebar-settings-option${newType === 'script' ? ' is-active' : ''}`}
                  onClick={() => setNewType('script')}
                >
                  {t('projects.typeScript')}
                </button>
              </div>
            </div>
            <div className="topbar-new-dialog-actions">
              <button type="button" className="auth-submit" onClick={handleCreate}>{t('projects.create')}</button>
              <button type="button" className="projects-cancel" onClick={() => setShowNewDialog(false)}>{t('projects.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
