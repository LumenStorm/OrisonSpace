import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { resolveErrorKey } from './errors';

export function ChapterResultPanel() {
  const { candidate, status, error, accept, reject, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      candidate: s.chapterCandidate,
      status: s.chapterCandidateStatus,
      error: s.chapterCandidateError,
      accept: s.acceptChapterCandidate,
      reject: s.rejectChapterCandidate,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  return (
    <section className="novel-chapter-result" role="region" aria-label="Chapter Result">
      <header className="novel-chapter-result-header">
        <strong>{t('novelChapter.result')}</strong>
        <span className="novel-chapter-result-status" data-status={status}>
          {t(`novelChapter.runStatusValue.${status}`)}
        </span>
      </header>

      {status === 'running' ? (
        <p className="novel-chapter-result-progress">{t('novelChapter.generating')}</p>
      ) : null}

      {error ? <p className="novel-chapter-result-error">{resolveErrorKey(error, t)}</p> : null}

      {candidate ? (
        <div className="novel-chapter-candidate">
          <h3 className="novel-chapter-candidate-title">{candidate.title}</h3>
          {candidate.summary ? (
            <p className="novel-chapter-candidate-summary">{candidate.summary}</p>
          ) : null}
          <pre className="novel-chapter-candidate-content">{candidate.content}</pre>
          {typeof candidate.wordCount === 'number' ? (
            <p className="novel-chapter-candidate-meta">{t('novelChapter.wordCount', { count: candidate.wordCount })}</p>
          ) : null}

          <div className="novel-chapter-actions">
            <button type="button" onClick={() => void accept()} className="primary">
              {t('novelChapter.acceptCandidate')}
            </button>
            <button type="button" onClick={reject}>
              {t('novelChapter.rejectCandidate')}
            </button>
          </div>
        </div>
      ) : status === 'idle' ? (
        <p className="novel-chapter-result-hint">{t('novelChapter.empty')}</p>
      ) : null}
    </section>
  );
}
