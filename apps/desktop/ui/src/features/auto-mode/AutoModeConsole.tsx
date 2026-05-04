import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { resolveErrorKey } from '../orchestration/errors';

export function AutoModeConsole() {
  const { state, error, start, pause, resume, cancel, refresh, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      state: s.autoModeState,
      error: s.autoModeError,
      start: s.startAutoMode,
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
        <button type="button" onClick={() => void start()} className="primary">
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
  const showCancelControl = state.status === 'running' || state.status === 'paused';

  return (
    <section className="auto-mode-console" aria-label="Auto Mode Console">
      <header className="auto-mode-console-header">
        <strong>{t('autoMode.title')}</strong>
        <span className="auto-mode-console-id">{state.autoModeId}</span>
      </header>

      <p>{t('autoMode.status', { value: t(`autoMode.statusValue.${state.status}`) })}</p>
      <p>{t('autoMode.progress', { value: progress })}</p>
      {state.currentChapterId ? <p>{t('autoMode.currentChapter', { id: state.currentChapterId })}</p> : null}
      {state.currentRunId ? <p className="auto-mode-console-run">{t('autoMode.currentRun', { id: state.currentRunId })}</p> : null}

      <div className="auto-mode-console-actions">
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
