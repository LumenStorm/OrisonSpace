import { useOrchestrationStore } from '../../shared/store/orchestrationStore';

function NodeProgress({ completedNodes, pendingNodes, currentNodeId }: {
  completedNodes: string[];
  pendingNodes: string[];
  currentNodeId: string | null;
}) {
  const allNodes = [...completedNodes, ...(currentNodeId && !completedNodes.includes(currentNodeId) ? [currentNodeId] : []), ...pendingNodes];
  return (
    <ul className="orchestration-nodes" aria-label="Node Progress">
      {allNodes.map((nodeId) => {
        const isDone = completedNodes.includes(nodeId);
        const isCurrent = nodeId === currentNodeId;
        const status = isDone ? 'done' : isCurrent ? 'running' : 'pending';
        return (
          <li key={nodeId} data-status={status}>
            <span className="node-indicator">{isDone ? '\u2713' : isCurrent ? '\u25B6' : '\u25CB'}</span>
            {' '}{nodeId}
          </li>
        );
      })}
    </ul>
  );
}

function ReviewActions() {
  const { performAction, loading } = useOrchestrationStore();
  return (
    <div className="orchestration-actions" aria-label="Review Actions">
      <p>流程需要人工介入</p>
      <button type="button" disabled={loading}
        onClick={() => void performAction({ action: 'accept_current' })}>
        接受当前结果
      </button>
      <button type="button" disabled={loading}
        onClick={() => void performAction({ action: 'abort_run' })}>
        终止流程
      </button>
    </div>
  );
}

function DeliveryView({ run }: { run: NonNullable<ReturnType<typeof useOrchestrationStore>['run']> }) {
  return (
    <div className="orchestration-delivery" aria-label="Delivery Output">
      <p>已交付 — {run.delivery?.summary}</p>
      {run.archive ? <p>归档版本: {run.archive.versionId}</p> : null}
      {run.feedback?.memo ? <p>回流备注: {run.feedback.memo}</p> : null}
    </div>
  );
}

export function OrchestrationPanel() {
  const { run, loading, error, startRun } = useOrchestrationStore();

  return (
    <section className="task-feed" aria-label="Orchestration Panel">
      {!run ? (
        <button type="button" disabled={loading}
          onClick={() => void startRun('local-preview', '生成一个黑暗风格的故事草稿')}>
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
              <p>审核: {run.review.verdict} — {run.review.summary}</p>
            </div>
          ) : null}
        </div>
      )}
      {error ? <p className="orchestration-error">{error}</p> : null}
    </section>
  );
}
