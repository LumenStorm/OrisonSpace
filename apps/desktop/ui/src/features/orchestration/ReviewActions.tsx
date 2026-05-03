import { useOrchestrationStore } from '../../shared/store/orchestrationStore';

export function ReviewActions() {
  const { performAction, loading } = useOrchestrationStore();
  return (
    <div className="orchestration-actions" aria-label="Review Actions">
      <p>流程需要人工介入</p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void performAction({ action: 'accept_current' })}
      >
        接受当前结果
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void performAction({ action: 'abort_run' })}
      >
        终止流程
      </button>
    </div>
  );
}
