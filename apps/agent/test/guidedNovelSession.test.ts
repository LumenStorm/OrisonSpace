import { describe, expect, it } from 'vitest';
import { createGuidedNovelSessionService } from '../src/engine/guidedNovel/sessionService';

describe('guided novel session service', () => {
  it('starts in interviewing and transitions to planning when readiness is met', async () => {
    const service = createGuidedNovelSessionService();
    const session = await service.start({
      projectPath: 'C:/Projects/Novel',
    });

    expect(session.session?.status).toBe('interviewing');

    const updated = await service.submitInterviewAnswer(session.session!.sessionId, {
      answer: 'Noir mystery with memory magic and a lonely detective.',
    });

    expect(updated.session?.status).toBe('planning');
    expect(updated.planningBaseline?.version).toBe(1);
  });

  it('restores a persisted session so later actions can continue', async () => {
    const service = createGuidedNovelSessionService();
    const restored = service.restore({
      session: {
        sessionId: 'guided_restored',
        projectPath: 'C:/Projects/Novel',
        status: 'planning',
        baselineVersion: 1,
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
      planningBaseline: {
        version: 1,
        fields: {
          creative_brief: {
            rawRequirement: 'A restored city remembers every visitor.',
          },
        },
      },
    });

    expect(restored.session?.sessionId).toBe('guided_restored');
    expect(service.get('guided_restored')?.session?.status).toBe('planning');
  });

  it('confirms the baseline and opens chapter review with the next chapter task card', async () => {
    const service = createGuidedNovelSessionService({
      runChapterCycle: async ({ chapterId, instruction }) => ({
        taskCard: {
          chapterId,
          title: 'Chapter 1',
          summary: instruction,
          goal: instruction,
          involvedAssetIds: ['guided_lonely-detective'],
          storyBeats: ['Detective arrives at the archive district.'],
        },
        run: {
          runId: 'run_guided_1',
          status: 'completed',
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
          artifacts: {
            chapter_candidate: {
              content: 'The detective arrived at the Archive District.',
            },
          },
          contextPacketPath: null,
          executionPath: [],
          activeNodeId: null,
        },
        checklist: {
          chapterId,
          items: [],
        },
      }),
    });
    const session = await service.start({
      projectPath: 'C:/Projects/Novel',
    });
    const updated = await service.submitInterviewAnswer(session.session!.sessionId, {
      answer: 'Noir mystery with memory magic and a lonely detective.',
    });

    const chapterReview = await service.confirmPlanning(updated.session!.sessionId);

    expect(chapterReview.session?.status).toBe('chapter_review_pending');
    expect(chapterReview.session?.currentChapterId).toBe('chapter-1');
    expect(chapterReview.currentTaskCard?.chapterId).toBe('chapter-1');
    expect(chapterReview.changeChecklist?.chapterId).toBe('chapter-1');
  });
});
