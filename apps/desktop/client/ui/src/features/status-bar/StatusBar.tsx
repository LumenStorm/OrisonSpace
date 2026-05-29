import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function StatusBar() {
  const {
    agentLoading,
    agentSessionId,
    activeFilePath,
    openFiles,
    resolvedLocale,
    activePage,
    cursorLine,
    cursorCol,
    wordCount,
  } = useAppStore(useShallow((s) => ({
    agentLoading: s.agentLoading,
    agentSessionId: s.agentSessionId,
    activeFilePath: s.activeFilePath,
    openFiles: s.openFiles,
    resolvedLocale: s.resolvedLocale,
    activePage: s.activePage,
    cursorLine: s.cursorLine,
    cursorCol: s.cursorCol,
    wordCount: s.wordCount,
  })));

  const { t } = useI18n(resolvedLocale);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  const agentStatus = agentLoading
    ? t('statusBar.agentRunning')
    : agentSessionId
      ? t('statusBar.agentIdle')
      : '';

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {activeFile && (
          <>
            {cursorLine > 0 && (
              <span className="status-bar-item">
                Ln {cursorLine}, Col {cursorCol}
              </span>
            )}
            {wordCount > 0 && (
              <span className="status-bar-item">
                {wordCount.toLocaleString()} {t('statusBar.words')}
              </span>
            )}
          </>
        )}
        {!activeFile && (
          <span className="status-bar-item status-bar-page">{activePage}</span>
        )}
      </div>
      <div className="status-bar-right">
        {agentStatus && (
          <span className={`status-bar-item status-bar-agent${agentLoading ? ' is-running' : ''}`}>
            <span className="material-symbols-outlined status-bar-agent-icon">smart_toy</span>
            {agentStatus}
          </span>
        )}
      </div>
    </div>
  );
}
