import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { resolveErrorKey } from '../orchestration/errors';

export function AutoModeConsole() {
  const [plotSummary, setPlotSummary] = useState('');
  const { state, error, start, approve, pause, resume, cancel, refresh, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      state: s.autoModeState,
      error: s.autoModeError,
      start: s.startAutoMode,
      approve: s.approveAutoModePlan,
      pause: s.pauseAutoMode,
      resume: s.resumeAutoMode,
      cancel: s.cancelAutoMode,
      refresh: s.refreshAutoMode,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  // 运行中时定时拉取后端最新状态
  useEffect(() => {
    if (!state || (state.status !== 'running' && state.status !== 'paused')) return;
    const timer = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [state?.status, state?.autoModeId, refresh]);

  if (!state) {
    return (
      <section className="auto-mode-console" aria-label="Auto Mode Console">
        <header className="auto-mode-console-header">
          <strong>{t('autoMode.title')}</strong>
        </header>
        <p className="auto-mode-console-hint">{t('autoMode.hint')}</p>
        <label className="auto-mode-console-field">
          <span>{t('autoMode.plotSummary')}</span>
          <textarea
            value={plotSummary}
            onChange={(event) => setPlotSummary(event.target.value)}
            placeholder={t('autoMode.plotSummaryPlaceholder')}
            rows={4}
          />
        </label>
        <button type="button" onClick={() => void start(undefined, plotSummary)} className="primary">
          {t('autoMode.start')}
        </button>
        {error ? <p className="auto-mode-console-error">{resolveErrorKey(error, t)}</p> : null}
      </section>
    );
  }

  const completed = state.completedChapterIds.length;
  const total = state.totalChapters;
  const progress = total > 0 ? `${completed} / ${total}` : '0 / 0';
  const showRunningControls = state.status === 'running';
  const showResumeControl = state.status === 'paused';
  const showApprovalControl = state.status === 'awaiting_approval';
  const showCancelControl = state.status === 'running' || state.status === 'paused' || state.status === 'awaiting_approval';

  return (
    <section className="auto-mode-console" aria-label="Auto Mode Console">
      <header className="auto-mode-console-header">
        <strong>{t('autoMode.title')}</strong>
        <span className="auto-mode-console-id">{state.autoModeId}</span>
      </header>

      <p>{t('autoMode.status', { value: t(`autoMode.statusValue.${state.status}`) })}</p>
      <p>{t('autoMode.progress', { value: progress })}</p>
      {state.plotSummary ? <p>{t('autoMode.plotSummaryStatus', { value: state.plotSummary })}</p> : null}
      {state.planning?.bundlePath ? <p className="auto-mode-console-run">{t('autoMode.bundlePath', { path: state.planning.bundlePath })}</p> : null}
      {state.currentChapterId ? <p>{t('autoMode.currentChapter', { id: state.currentChapterId })}</p> : null}
      {state.currentRunId ? <p className="auto-mode-console-run">{t('autoMode.currentRun', { id: state.currentRunId })}</p> : null}

      <div className="auto-mode-console-actions">
        {showApprovalControl ? (
          <button type="button" className="primary" onClick={() => void approve()}>
            {t('autoMode.approvePlan')}
          </button>
        ) : null}
        {showRunningControls ? (
          <button type="button" onClick={() => void pause()}>
            {t('autoMode.pause')}
          </button>
        ) : null}
        {showResumeControl ? (
          <button type="button" onClick={() => void resume()}>
            {t('autoMode.resume')}
          </button>
        ) : null}
        {showCancelControl ? (
          <button type="button" onClick={() => void cancel()}>
            {t('autoMode.cancel')}
          </button>
        ) : null}
      </div>

      {state.status === 'failed' && state.lastError ? (
        <p className="auto-mode-console-error">{t('autoMode.errorPrefix', { message: state.lastError })}</p>
      ) : null}
      {error ? <p className="auto-mode-console-error">{resolveErrorKey(error, t)}</p> : null}
    </section>
  );
}
