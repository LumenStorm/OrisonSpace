import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const actionGroups = [
  ['add', 'folder_open', 'save', 'ios_share'],
  ['undo', 'redo'],
  ['settings', 'help_outline']
];

const isMac = window.orisonDesktop?.platform === 'darwin';

export function TopBar() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.orisonDesktop?.isMaximized?.().then(setMaximized);
  }, []);

  const handleMinimize = useCallback(() => window.orisonDesktop?.minimize(), []);
  const handleMaximize = useCallback(() => {
    window.orisonDesktop?.maximize();
    setMaximized((v) => !v);
  }, []);
  const handleClose = useCallback(() => window.orisonDesktop?.close(), []);

  return (
    <header className="workspace-topbar">
      {/* macOS 红绿灯占位 */}
      {isMac && <div className="topbar-traffic-light-spacer" />}

      <div className="workspace-brand">{t('welcome.brand')}</div>
      <div className="workspace-actions" aria-label="Workspace Actions">
        {actionGroups.map((group, index) => (
          <div key={group.join('-')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {group.map((icon) => (
              <button key={icon} className="workspace-action" type="button" aria-label={icon}>
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
            {index < actionGroups.length - 1 ? <div className="workspace-divider" /> : null}
          </div>
        ))}
      </div>

      {/* Windows/Linux 窗口控制按钮 */}
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
  );
}
