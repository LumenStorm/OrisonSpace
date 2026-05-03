import { useEffect } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useOrchestrationStore, type PatchDeliveredCallback } from '../../shared/store/orchestrationStore';
import { DeliveryView } from './DeliveryView';
import { NodeProgress } from './NodeProgress';
import { ReviewActions } from './ReviewActions';

export function OrchestrationPanel() {
  const { run, loading, error, startRun, setOnPatchDelivered } = useOrchestrationStore();

  useEffect(() => {
    const handler: PatchDeliveredCallback = (patch) => {
      const appState = useAppStore.getState();
      appState.setPendingPatch(patch);
      if (appState.autoApplyPatches) {
        for (const entry of patch.patches) {
          appState.togglePatchSelection(entry.field);
        }
        appState.applySelectedPatches();
      }
    };
    setOnPatchDelivered(handler);
    return () => setOnPatchDelivered(null);
  }, [setOnPatchDelivered]);

  return (
    <section className="task-feed" aria-label="Orchestration Panel">
      {!run ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startRun('local-preview', '生成一个黑暗风格的故事草稿')}
        >
          {loading ? '启动中...' : '启动主链路'}
        </button>
      ) : (
        <div>
          <p>Run: {run.runId}</p>
          <p>状态: {run.status}</p>

          <NodeProgress
            completedNodes={run.completedNodes}
            pendingNodes={run.pendingNodes}
            currentNodeId={run.currentNodeId}
          />

          {(run.status === 'human_in_loop' || run.status === 'revision_pending') && (
            <ReviewActions />
          )}

          {run.status === 'delivered' && <DeliveryView run={run} />}

          {run.review && run.status !== 'delivered' ? (
            <div className="orchestration-review">
              <p>审核: {run.review.verdict} - {run.review.summary}</p>
            </div>
          ) : null}
        </div>
      )}
      {error ? <p className="orchestration-error">{error}</p> : null}
    </section>
  );
}
