import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { PatchOperation } from '../../shared/store/types';

export function TaskFeedPanel() {
  const currentTask = useAppStore((s) => s.currentTask);
  const acceptTaskResult = useAppStore((s) => s.acceptTaskResult);
  const submitRewrite = useAppStore((s) => s.submitRewrite);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!currentTask) {
    return <div className="task-feed" />;
  }

  const { result } = currentTask;

  if (!result || result.status === 'queued' || result.status === 'running') {
    return (
      <div className="task-feed">
        <p>{t('tasks.inProgress')}</p>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <div className="task-feed">
        <p>{t('tasks.failed', { summary: result.summary })}</p>
        <button
          type="button"
          onClick={() => submitRewrite(currentTask.request.input)}
        >
          {t('tasks.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="task-feed">
      <p>{result.summary}</p>
      {result.outputPayload?.operations.map((op: PatchOperation, i: number) => (
        <div key={i} className="task-patch-preview">
          <code>{op.path}: {String(op.value)}</code>
        </div>
      ))}
      <div className="task-actions">
        <button type="button" onClick={acceptTaskResult}>
          {t('tasks.accept')}
        </button>
      </div>
    </div>
  );
}
