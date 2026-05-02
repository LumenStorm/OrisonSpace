import { useEffect } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import type { AutoModeState } from '../../shared/store/novelChapterSlice';

const STATUS_LABEL: Record<AutoModeState['status'], string> = {
  idle: '未启动',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
  failed: '失败',
};

export function AutoModeConsole() {
  const state = useAppStore((s) => s.autoModeState);
  const error = useAppStore((s) => s.autoModeError);
  const start = useAppStore((s) => s.startAutoMode);
  const pause = useAppStore((s) => s.pauseAutoMode);
  const resume = useAppStore((s) => s.resumeAutoMode);
  const cancel = useAppStore((s) => s.cancelAutoMode);
  const refresh = useAppStore((s) => s.refreshAutoMode);

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
          <strong>自动模式</strong>
        </header>
        <p className="auto-mode-console-hint">
          自动模式将依次推进所有未定稿章节。
        </p>
        <button type="button" onClick={() => void start()} className="primary">
          启动自动模式
        </button>
        {error ? <p className="auto-mode-console-error">{error}</p> : null}
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
        <strong>自动模式</strong>
        <span className="auto-mode-console-id">{state.autoModeId}</span>
      </header>

      <p>状态：{STATUS_LABEL[state.status]}</p>
      <p>进度：{progress}</p>
      {state.currentChapterId ? <p>当前章节：{state.currentChapterId}</p> : null}
      {state.currentRunId ? <p className="auto-mode-console-run">Run: {state.currentRunId}</p> : null}

      <div className="auto-mode-console-actions">
        {showRunningControls ? (
          <button type="button" onClick={() => void pause()}>
            暂停
          </button>
        ) : null}
        {showResumeControl ? (
          <button type="button" onClick={() => void resume()}>
            恢复
          </button>
        ) : null}
        {showCancelControl ? (
          <button type="button" onClick={() => void cancel()}>
            取消
          </button>
        ) : null}
      </div>

      {state.status === 'failed' && state.lastError ? (
        <p className="auto-mode-console-error">错误：{state.lastError}</p>
      ) : null}
      {error ? <p className="auto-mode-console-error">{error}</p> : null}
    </section>
  );
}
