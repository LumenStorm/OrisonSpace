import { useAppStore } from '../../shared/store/appStore';

export function TaskFeedPanel() {
  const currentTask = useAppStore((s) => s.currentTask);
  const acceptTaskResult = useAppStore((s) => s.acceptTaskResult);
  const submitRewrite = useAppStore((s) => s.submitRewrite);

  if (!currentTask) {
    return (
      <div className="task-feed">
        <button
          type="button"
          onClick={() => submitRewrite('Make the opening darker.')}
        >
          Run AI Rewrite
        </button>
      </div>
    );
  }

  const { result } = currentTask;

  if (!result || result.status === 'queued' || result.status === 'running') {
    return (
      <div className="task-feed">
        <p>Task in progress…</p>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <div className="task-feed">
        <p>Task failed: {result.summary}</p>
        <button
          type="button"
          onClick={() => submitRewrite(currentTask.request.userInstruction)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="task-feed">
      <p>{result.summary}</p>
      {result.outputPayload?.operations.map((op, i) => (
        <div key={i} className="task-patch-preview">
          <code>{op.path}: {String(op.value)}</code>
        </div>
      ))}
      <div className="task-actions">
        <button type="button" onClick={acceptTaskResult}>
          Accept Task Result
        </button>
      </div>
    </div>
  );
}
