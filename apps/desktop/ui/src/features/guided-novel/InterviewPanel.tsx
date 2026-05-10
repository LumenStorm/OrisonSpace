import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function InterviewPanel() {
  const [answer, setAnswer] = useState('');
  const state = useAppStore((s) => s.guidedNovelState);
  const submitGuidedNovelAnswer = useAppStore((s) => s.submitGuidedNovelAnswer);
  const guidedNovelLoading = useAppStore((s) => s.guidedNovelLoading);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const latestPrompt =
    state?.interviewState?.messages
      ?.slice()
      .reverse()
      .find((message) => message.role === 'assistant')?.content ??
    t('guidedNovel.interviewDefaultPrompt');

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.interviewTitle')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.title')}</span>
        <h2>{t('guidedNovel.interviewTitle')}</h2>
        <p>{latestPrompt}</p>
      </div>
      <textarea
        className="guided-novel-textarea"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder={t('guidedNovel.interviewPrompt')}
      />
      <div className="guided-novel-actions">
        <button
          type="button"
          className="guided-novel-primary"
          disabled={!answer.trim() || guidedNovelLoading}
          onClick={() => void submitGuidedNovelAnswer(answer)}
        >
          {t('guidedNovel.interviewContinue')}
        </button>
      </div>
    </section>
  );
}
