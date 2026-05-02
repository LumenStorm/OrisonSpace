import { useAppStore } from '../../shared/store/appStore';

const RUN_STATUS_LABEL: Record<string, string> = {
  idle: '待生成',
  running: '生成中…',
  pending: '等待审阅',
  accepted: '已接受',
  rejected: '已丢弃',
  failed: '失败',
};

export function ChapterResultPanel() {
  const candidate = useAppStore((s) => s.chapterCandidate);
  const status = useAppStore((s) => s.chapterCandidateStatus);
  const error = useAppStore((s) => s.chapterCandidateError);
  const accept = useAppStore((s) => s.acceptChapterCandidate);
  const reject = useAppStore((s) => s.rejectChapterCandidate);

  return (
    <section className="novel-chapter-result" role="region" aria-label="Chapter Result">
      <header className="novel-chapter-result-header">
        <strong>结果</strong>
        <span className="novel-chapter-result-status" data-status={status}>
          {RUN_STATUS_LABEL[status] ?? status}
        </span>
      </header>

      {status === 'running' ? (
        <p className="novel-chapter-result-progress">生成中，请稍候…</p>
      ) : null}

      {error ? <p className="novel-chapter-result-error">{error}</p> : null}

      {candidate ? (
        <div className="novel-chapter-candidate">
          <h3 className="novel-chapter-candidate-title">{candidate.title}</h3>
          {candidate.summary ? (
            <p className="novel-chapter-candidate-summary">{candidate.summary}</p>
          ) : null}
          <pre className="novel-chapter-candidate-content">{candidate.content}</pre>
          {typeof candidate.wordCount === 'number' ? (
            <p className="novel-chapter-candidate-meta">字数：{candidate.wordCount}</p>
          ) : null}

          <div className="novel-chapter-actions">
            <button type="button" onClick={() => void accept()} className="primary">
              接受候选
            </button>
            <button type="button" onClick={reject}>
              丢弃候选
            </button>
          </div>
        </div>
      ) : status === 'idle' ? (
        <p className="novel-chapter-result-hint">尚无候选，请先选择章节并触发生成。</p>
      ) : null}
    </section>
  );
}
