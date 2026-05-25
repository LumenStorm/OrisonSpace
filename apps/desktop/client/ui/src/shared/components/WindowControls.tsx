import { useCallback, useEffect, useState } from 'react';

function detectIsMac() {
  if (typeof window === 'undefined') return false;
  return window.orisonDesktop?.platform === 'darwin';
}

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const isMac = detectIsMac();

  useEffect(() => {
    window.orisonDesktop?.isMaximized?.().then(setMaximized);
  }, []);

  const handleMinimize = useCallback(() => window.orisonDesktop?.minimize(), []);
  const handleMaximize = useCallback(() => {
    window.orisonDesktop?.maximize();
    setMaximized((v) => !v);
  }, []);
  const handleClose = useCallback(() => window.orisonDesktop?.close(), []);

  if (isMac) return null;

  return (
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
  );
}

export { detectIsMac };
