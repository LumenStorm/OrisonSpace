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
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="bottom-panel-placeholder">
      <span className="material-symbols-outlined" aria-hidden="true">output</span>
      <p>{t('bottomPanel.noOutput')}</p>
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
