import { describe, expect, it } from 'vitest';
import { deriveGuidedChangeChecklist } from '../src/engine/guidedNovel/changeReviewService';
import { buildImpactReview } from '../src/engine/guidedNovel/impactReviewService';

describe('guided novel change review', () => {
  it('derives new character and setting updates from chapter artifacts', () => {
    const checklist = deriveGuidedChangeChecklist({
      chapterId: 'chapter-5',
      chapterText: 'Lin Qi met Shao Yun in the Lantern Archive.',
      currentAssets: [{ id: 'char_lin_qi', type: 'character', name: 'Lin Qi' }],
      currentWorldSetting: { locations: [] },
    });

    expect(checklist.items.some((item) => item.type === 'new_character')).toBe(true);
    expect(checklist.items.some((item) => item.type === 'new_location')).toBe(true);
  });

  it('recommends replanning when structural baseline fields change', () => {
    const review = buildImpactReview({
      field: 'outline_v2',
      upcomingPhaseIds: ['phase-2'],
      upcomingChapterIds: ['chapter-6', 'chapter-7'],
      affectedAssetIds: ['char_lin_qi'],
    });

    expect(review.recommendation).toBe('replan');
    expect(review.affectedChapterIds).toContain('chapter-6');
  });
});
