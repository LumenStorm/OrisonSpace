import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { PendingDiff } from '../../shared/store/agentSlice';

type DiffLine = { type: 'same' | 'add' | 'remove'; left: string; right: string; lineLeft: number; lineRight: number };

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];
  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ type: 'same', left: oldLines[i], right: newLines[j], lineLeft: i + 1, lineRight: j + 1 });
      i++; j++;
    } else {
      // Simple greedy: look ahead for a match
      let foundI = -1, foundJ = -1;
      for (let lookahead = 1; lookahead < 10; lookahead++) {
        if (i + lookahead < oldLines.length && oldLines[i + lookahead] === newLines[j]) { foundI = i + lookahead; break; }
        if (j + lookahead < newLines.length && oldLines[i] === newLines[j + lookahead]) { foundJ = j + lookahead; break; }
      }
      if (foundI > 0) {
        while (i < foundI) { result.push({ type: 'remove', left: oldLines[i], right: '', lineLeft: i + 1, lineRight: 0 }); i++; }
      } else if (foundJ > 0) {
        while (j < foundJ) { result.push({ type: 'add', left: '', right: newLines[j], lineLeft: 0, lineRight: j + 1 }); j++; }
      } else {
        if (i < oldLines.length) { result.push({ type: 'remove', left: oldLines[i], right: '', lineLeft: i + 1, lineRight: 0 }); i++; }
        if (j < newLines.length) { result.push({ type: 'add', left: '', right: newLines[j], lineLeft: 0, lineRight: j + 1 }); j++; }
      }
    }
  }
  return result;
}

type Props = {
  diff: PendingDiff;
  oldContent: string;
  onClose: () => void;
};

export function SideBySideDiff({ diff, oldContent, onClose }: Props) {
  const { acceptDiff, rejectDiff, resolvedLocale } = useAppStore(useShallow((s) => ({
    acceptDiff: s.acceptDiff,
    rejectDiff: s.rejectDiff,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);
  // Whole-chapter view. Passage diffs render their own compact view (Phase 2);
  // fall back to the replacement text if a passage diff ever reaches here.
  const newContent = diff.kind === 'chapter' ? diff.content : diff.replacement;
  const fileName = diff.kind === 'chapter' ? diff.fileName : (diff.filePath ?? diff.chapterId ?? 'passage');
  const lines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  // Per-line accept state: accepted lines override old with new
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());

  const toggleAccept = (idx: number) => {
    const next = new Set(accepted);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setAccepted(next);
    setRejected((prev) => { const n = new Set(prev); n.delete(idx); return n; });
  };

  const toggleReject = (idx: number) => {
    const next = new Set(rejected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setRejected(next);
    setAccepted((prev) => { const n = new Set(prev); n.delete(idx); return n; });
  };

  const handleAcceptAll = () => acceptDiff(diff.id);
  const handleRejectAll = () => { rejectDiff(diff.id); onClose(); };

  return (
    <div className="diff-side-by-side">
      <div className="diff-sbs-header">
        <span className="diff-sbs-filename">{fileName}</span>
        <div className="diff-sbs-actions">
          <button type="button" className="diff-sbs-btn diff-sbs-btn--accept" onClick={handleAcceptAll}>
            {t('agent.accept')} All
          </button>
          <button type="button" className="diff-sbs-btn diff-sbs-btn--reject" onClick={handleRejectAll}>
            {t('agent.reject')} All
          </button>
          <button type="button" className="diff-sbs-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      <div className="diff-sbs-body">
        <div className="diff-sbs-col diff-sbs-col--left">
          <div className="diff-sbs-col-header">{t('agent.original') || 'Original'}</div>
          {lines.map((l, idx) => (
            <div key={idx} className={`diff-sbs-line diff-sbs-line--${l.type}${rejected.has(idx) ? ' diff-sbs-line--rejected' : ''}`}>
              <span className="diff-sbs-ln">{l.lineLeft || ''}</span>
              <span className="diff-sbs-text">{l.left}</span>
            </div>
          ))}
        </div>
        <div className="diff-sbs-gutter">
          {lines.map((l, idx) => (
            <div key={idx} className="diff-sbs-gutter-row">
              {l.type !== 'same' && (
                <>
                  <button type="button" className={`diff-sbs-gutter-btn${accepted.has(idx) ? ' is-active' : ''}`} title="Accept" onClick={() => toggleAccept(idx)}>
                    <span className="material-symbols-outlined">check</span>
                  </button>
                  <button type="button" className={`diff-sbs-gutter-btn diff-sbs-gutter-btn--reject${rejected.has(idx) ? ' is-active' : ''}`} title="Reject" onClick={() => toggleReject(idx)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="diff-sbs-col diff-sbs-col--right">
          <div className="diff-sbs-col-header">{t('agent.modified') || 'Modified'}</div>
          {lines.map((l, idx) => (
            <div key={idx} className={`diff-sbs-line diff-sbs-line--${l.type}${accepted.has(idx) ? ' diff-sbs-line--accepted' : ''}`}>
              <span className="diff-sbs-ln">{l.lineRight || ''}</span>
              <span className="diff-sbs-text">{l.right}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
