import { useOrchestrationStore } from '../../shared/store/orchestrationStore';

export function OrchestrationPanel() {
  const { run, loading, error, startRun } = useOrchestrationStore();

  return (
    <section className="task-feed" aria-label="Orchestration Panel">
      <button type="button" onClick={() => void startRun()} disabled={loading}>
        {loading ? 'Starting...' : 'Start Main Chain'}
      </button>
      {error ? <p>{error}</p> : null}
      {run ? (
        <div>
          <p>Run: {run.runId}</p>
          <p>Status: {run.status}</p>
          <p>Current Node: {run.currentNodeId ?? 'none'}</p>
        </div>
      ) : null}
    </section>
  );
}
