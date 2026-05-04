import { useAppStore, type BottomPanelTab } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { TaskFeedPanel } from '../tasks/TaskFeedPanel';

const tabs: { key: BottomPanelTab; icon: string; i18nKey: string }[] = [
  { key: 'properties', icon: 'tune', i18nKey: 'bottomPanel.properties' },
  { key: 'tasks', icon: 'task_alt', i18nKey: 'bottomPanel.tasks' },
  { key: 'output', icon: 'output', i18nKey: 'bottomPanel.output' },
];

function OutputPanel() {
  const {
    outputEntries,
    clearOutputEntries,
    resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    outputEntries: s.outputEntries,
    clearOutputEntries: s.clearOutputEntries,
    resolvedLocale: s.resolvedLocale,
  })));

  return (
    <div className="output-console" role="log" aria-live="polite">
      <div className="output-console-toolbar">
        <span className="output-console-title">Console</span>
        <button type="button" className="output-console-clear" onClick={clearOutputEntries}>
          <span className="material-symbols-outlined" aria-hidden="true">backspace</span>
        </button>
      </div>
      <div className="output-console-stream">
        {outputEntries.length === 0 ? (
          <div className="output-console-line" data-level="info">
            <span className="output-console-time">{formatTime(new Date().toISOString(), resolvedLocale)}</span>
            <span className="output-console-scope">system</span>
            <span className="output-console-message">Ready</span>
          </div>
        ) : (
          outputEntries.map((entry) => (
            <div key={entry.id} className="output-console-line" data-level={entry.level}>
              <span className="output-console-time">{formatTime(entry.timestamp, resolvedLocale)}</span>
              <span className="output-console-scope">{entry.scope}</span>
              <span className="output-console-message">{entry.message}</span>
              {entry.detail ? <span className="output-console-detail">{entry.detail}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function BottomPanel() {
  const {
    activeBottomTab, setActiveBottomTab,
    toggleBottomPanel, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    activeBottomTab: s.activeBottomTab,
    setActiveBottomTab: s.setActiveBottomTab,
    toggleBottomPanel: s.toggleBottomPanel,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);

  return (
    <div className="bottom-panel">
      <div className="bottom-panel-header">
        <nav className="bottom-panel-tabs" aria-label="Bottom Panel Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`bottom-panel-tab${activeBottomTab === tab.key ? ' bottom-panel-tab-active' : ''}`}
              onClick={() => setActiveBottomTab(tab.key)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
              {t(tab.i18nKey)}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="bottom-panel-collapse-btn"
          aria-label="Collapse panel"
          onClick={toggleBottomPanel}
        >
          <span className="material-symbols-outlined">expand_more</span>
        </button>
      </div>
      <div className="bottom-panel-content">
        {activeBottomTab === 'properties' && <InspectorPanel />}
        {activeBottomTab === 'tasks' && <TaskFeedPanel />}
        {activeBottomTab === 'output' && <OutputPanel />}
      </div>
    </div>
  );
}

function formatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
