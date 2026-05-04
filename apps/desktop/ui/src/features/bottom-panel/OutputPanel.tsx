import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { formatTime } from './utils';

export function OutputPanel() {
  const {
    outputEntries,
    clearOutputEntries,
    resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    outputEntries: s.outputEntries,
    clearOutputEntries: s.clearOutputEntries,
    resolvedLocale: s.resolvedLocale,
  })));

  return (
    <div className="output-console" role="log" aria-live="polite">
      <div className="output-console-toolbar">
        <span className="output-console-title">Console</span>
        <button type="button" className="output-console-clear" onClick={clearOutputEntries}>
          <span className="material-symbols-outlined" aria-hidden="true">backspace</span>
        </button>
      </div>
      <div className="output-console-stream">
        {outputEntries.length === 0 ? (
          <div className="output-console-line" data-level="info">
            <span className="output-console-time">{formatTime(new Date().toISOString(), resolvedLocale)}</span>
            <span className="output-console-scope">system</span>
            <span className="output-console-message">Ready</span>
          </div>
        ) : (
          outputEntries.map((entry) => (
            <div key={entry.id} className="output-console-line" data-level={entry.level}>
              <span className="output-console-time">{formatTime(entry.timestamp, resolvedLocale)}</span>
              <span className="output-console-scope">{entry.scope}</span>
              <span className="output-console-message">{entry.message}</span>
              {entry.detail ? <span className="output-console-detail">{entry.detail}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
