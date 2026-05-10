import { describe, expect, it } from 'vitest';
import {
  guidedNovelSessionSchema,
  guidedInterviewDraftSchema,
  guidedChangeChecklistSchema,
} from '../src/contracts/guided-novel';

describe('guided novel contracts', () => {
  it('parses a guided session with planning and chapter review states', () => {
    const parsed = guidedNovelSessionSchema.parse({
      sessionId: 'session_1',
      projectPath: 'C:/Projects/Novel',
      status: 'chapter_review_pending',
      baselineVersion: 3,
      currentPhaseId: 'phase-1',
      currentChapterId: 'chapter-3',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
    });

    expect(parsed.status).toBe('chapter_review_pending');
  });

  it('keeps interview draft sections and readiness scores explicit', () => {
    const parsed = guidedInterviewDraftSchema.parse({
      concept: { premise: 'A detective pursues a vanished city.' },
      cast: { protagonist: { name: 'Lin Qi' } },
      world: { rules: ['Memory has a cost.'] },
      plot: { coreConflict: 'Truth versus survival' },
      constraints: { mustHave: ['slow-burn tension'] },
      confidence: {
        concept: 0.9,
        cast: 0.7,
        world: 0.6,
        plot: 0.8,
        constraints: 0.7,
        canEnterPlanning: false,
      },
    });

    expect(parsed.confidence.canEnterPlanning).toBe(false);
  });

  it('models change checklist items with accept/edit/merge decisions', () => {
    const parsed = guidedChangeChecklistSchema.parse({
      chapterId: 'chapter-4',
      items: [
        {
          id: 'change_1',
          type: 'new_character',
          sourceChapterId: 'chapter-4',
          targetIds: [],
          suggestedOperation: 'create',
          confidence: 'high',
          payload: { name: 'Shao Yun' },
          decision: 'pending',
        },
      ],
    });

    expect(parsed.items[0]?.type).toBe('new_character');
  });
});
