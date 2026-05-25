import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { DeliveryView } from './DeliveryView';
import { NodeProgress } from './NodeProgress';
import { ReviewActions } from './ReviewActions';
import { resolveErrorKey } from './errors';

export function OrchestrationPanel() {
  const { run, loading, error, startRun, resolvedLocale } = useAppStore(useShallow((s) => ({
    run: s.orchestrationRun,
    loading: s.orchestrationLoading,
    error: s.orchestrationError,
    startRun: s.startOrchestrationRun,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);

  return (
    <section className="task-feed" aria-label="Orchestration Panel">
      {!run ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startRun('local-preview', '生成一个黑暗风格的故事草稿')}
        >
          {loading ? t('orchestration.starting') : t('orchestration.startMain')}
        </button>
      ) : (
        <div>
          <p>{t('orchestration.runId', { id: run.runId })}</p>
          <p>{t('orchestration.status', { value: run.status })}</p>

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
              <p>{t('orchestration.reviewSummary', { verdict: run.review.verdict ?? '', summary: run.review.summary })}</p>
            </div>
          ) : null}
        </div>
      )}
      {error ? <p className="orchestration-error">{resolveErrorKey(error, t)}</p> : null}
    </section>
  );
}
