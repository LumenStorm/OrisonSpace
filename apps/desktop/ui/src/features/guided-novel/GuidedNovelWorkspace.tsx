import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { InterviewPanel } from './InterviewPanel';
import { PlanningWorkspace } from './PlanningWorkspace';
import { ChapterReviewPanel } from './ChapterReviewPanel';
import { ChangeReviewPanel } from './ChangeReviewPanel';
import { ImpactReviewPanel } from './ImpactReviewPanel';

export function GuidedNovelWorkspace() {
  const guidedNovelState = useAppStore((s) => s.guidedNovelState);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  const status = guidedNovelState?.session?.status ?? 'interviewing';

  if (status === 'interviewing' || !guidedNovelState?.session) {
    return <InterviewPanel />;
  }

  if (status === 'planning' || status === 'ready_to_write') {
    return <PlanningWorkspace />;
  }

  if (status === 'chapter_review_pending') {
    return <ChapterReviewPanel />;
  }

  if (status === 'change_review_pending') {
    return <ChangeReviewPanel />;
  }

  if (status === 'impact_review_pending' || status === 'replanning') {
    return <ImpactReviewPanel />;
  }

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.unavailable')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.title')}</span>
        <h2>{t('guidedNovel.unavailable')}</h2>
      </div>
    </section>
  );
}
