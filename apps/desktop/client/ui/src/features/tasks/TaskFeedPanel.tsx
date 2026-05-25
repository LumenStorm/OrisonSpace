import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { BgTask } from '../../shared/store/backgroundTasksSlice';

export function TaskFeedPanel() {
  const bgTasks = useAppStore((s) => s.bgTasks);
  const cancelBgTask = useAppStore((s) => s.cancelBgTask);
  const dismissBgTask = useAppStore((s) => s.dismissBgTask);
  const clearFinishedBgTasks = useAppStore((s) => s.clearFinishedBgTasks);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (bgTasks.length === 0) {
    return (
      <div className="task-feed">
        <p className="task-feed-empty">{t('tasks.empty')}</p>
      </div>
    );
  }

  const hasFinished = bgTasks.some((t) => t.status !== 'running');

  return (
    <div className="task-feed">
      {hasFinished && (
        <div className="task-feed-toolbar">
          <button type="button" className="task-feed-clear-btn" onClick={clearFinishedBgTasks}>
            <span className="material-symbols-outlined">delete_sweep</span>
            {t('tasks.clearFinished')}
          </button>
        </div>
      )}
      <div className="task-feed-list">
        {bgTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onCancel={() => cancelBgTask(task.id)}
            onDismiss={() => dismissBgTask(task.id)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onCancel, onDismiss, t }: {
  task: BgTask;
  onCancel: () => void;
  onDismiss: () => void;
  t: (key: string) => string;
}) {
  const time = new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`task-row task-row-${task.status}`}>
      <span className="task-row-time">{time}</span>
      <span className="task-row-icon">
        {task.status === 'running' && <span className="material-symbols-outlined spin">progress_activity</span>}
        {task.status === 'completed' && <span className="material-symbols-outlined">check_circle</span>}
        {task.status === 'failed' && <span className="material-symbols-outlined">error</span>}
        {task.status === 'cancelled' && <span className="material-symbols-outlined">cancel</span>}
      </span>
      <span className="task-row-label">{task.label}</span>
      {task.error && <span className="task-row-error">{task.error}</span>}
      <span className="task-row-actions">
        {task.status === 'running' && (
          <button type="button" className="task-row-btn" onClick={onCancel} title={t('tasks.cancel')}>
            <span className="material-symbols-outlined">stop</span>
          </button>
        )}
        {task.status !== 'running' && (
          <button type="button" className="task-row-btn" onClick={onDismiss} title={t('tasks.dismiss')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </span>
    </div>
  );
}
