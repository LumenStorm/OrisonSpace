import { AcceptedPatchesView } from '../editor/AcceptedPatchesView';
import { OutputPanel } from '../bottom-panel/OutputPanel';
import { TaskFeedPanel } from '../tasks/TaskFeedPanel';
import { useAppStore } from '../../shared/store/appStore';
import type { SystemRailTab } from '../../shared/store/types';

const tabs: Array<{ key: SystemRailTab; label: string }> = [
  { key: 'runs', label: '运行记录' },
  { key: 'tasks', label: '后台任务' },
  { key: 'reviews', label: '审阅队列' },
  { key: 'patches', label: '补丁记录' },
];

export function SystemRail() {
  const activeTab = useAppStore((s) => s.novelWorkspace.systemRailTab);
  const setSystemRailTab = useAppStore((s) => s.setSystemRailTab);

  return (
    <section className="system-rail" aria-label="System Rail">
      <div className="system-rail-header">
        <nav className="system-rail-tabs" aria-label="System Rail Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`system-rail-tab${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => setSystemRailTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="system-rail-content">
        {activeTab === 'runs' ? (
          <OutputPanel />
        ) : activeTab === 'tasks' ? (
          <TaskFeedPanel />
        ) : activeTab === 'patches' ? (
          <AcceptedPatchesView />
        ) : (
          <div className="system-rail-placeholder">
            <h3>审阅队列</h3>
            <p>章节审阅、变更审阅和影响分析会在这里集中排队展示。</p>
          </div>
        )}
      </div>
    </section>
  );
}
