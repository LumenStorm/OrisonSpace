import crypto from 'node:crypto';
import {
  guidedChangeChecklistSchema,
  guidedNovelProjectStateSchema,
  guidedNovelStartRequestSchema,
  guidedNovelInterviewAnswerSchema,
  guidedNovelSessionSchema,
} from '@orison/shared-contracts';
import type { GuidedNovelProjectState } from '@orison/shared-contracts';
import { createInterviewService } from './interviewService';
import { createPlanningService } from './planningService';
import { runGuidedChapterCycle, type GuidedChapterCycleInput, type GuidedChapterCycleResult } from './chapterLoopService';

type GuidedNovelSessionServiceDeps = {
  runChapterCycle?: (input: GuidedChapterCycleInput) => Promise<GuidedChapterCycleResult>;
};

export function createGuidedNovelSessionService(deps: GuidedNovelSessionServiceDeps = {}) {
  const sessions = new Map<string, GuidedNovelProjectState>();
  const interviewService = createInterviewService();
  const planningService = createPlanningService();
  const runChapterCycle = deps.runChapterCycle ?? runGuidedChapterCycle;

  return {
    async start(input: unknown): Promise<GuidedNovelProjectState> {
      const parsed = guidedNovelStartRequestSchema.parse(input);
      const now = new Date().toISOString();
      const sessionId = `guided_${crypto.randomUUID()}`;
      const interviewState = interviewService.createInitialState();
      const state = guidedNovelProjectStateSchema.parse({
        session: guidedNovelSessionSchema.parse({
          sessionId,
          projectPath: parsed.projectPath,
          status: 'interviewing',
          baselineVersion: 0,
          currentPhaseId: null,
          currentChapterId: null,
          createdAt: now,
          updatedAt: now,
        }),
        interviewState,
        interviewDraft: interviewState.draft,
      });

      sessions.set(sessionId, state);
      return state;
    },

    restore(input: unknown): GuidedNovelProjectState {
      const state = guidedNovelProjectStateSchema.parse(input);
      if (!state.session?.sessionId) {
        throw new Error('guided novel session is required for restore');
      }
      sessions.set(state.session.sessionId, state);
      return state;
    },

    async submitInterviewAnswer(sessionId: string, input: unknown): Promise<GuidedNovelProjectState> {
      const current = sessions.get(sessionId);
      if (!current?.session) {
        throw new Error(`guided novel session not found: ${sessionId}`);
      }

      const parsed = guidedNovelInterviewAnswerSchema.parse(input);
      const interviewState = interviewService.appendAnswer(
        current.interviewState ?? interviewService.createInitialState(),
        parsed.answer,
      );
      const canEnterPlanning = interviewState.draft.confidence.canEnterPlanning;
      const planningBaseline = canEnterPlanning
        ? planningService.buildBaseline(
            interviewState.draft,
            current.planningBaseline?.version ?? 1,
          )
        : current.planningBaseline;

      const nextState = guidedNovelProjectStateSchema.parse({
        ...current,
        session: {
          ...current.session,
          status: canEnterPlanning ? 'planning' : 'interviewing',
          baselineVersion: planningBaseline?.version ?? current.session.baselineVersion,
          updatedAt: new Date().toISOString(),
        },
        interviewState,
        interviewDraft: interviewState.draft,
        planningBaseline,
      });

      sessions.set(sessionId, nextState);
      return nextState;
    },

    async confirmPlanning(sessionId: string): Promise<GuidedNovelProjectState> {
      const current = sessions.get(sessionId);
      if (!current?.session) {
        throw new Error(`guided novel session not found: ${sessionId}`);
      }
      if (!current.planningBaseline?.fields) {
        throw new Error(`guided novel planning baseline missing: ${sessionId}`);
      }

      const chapterId = nextChapterId(current.session.currentChapterId);
      const instruction = buildChapterInstruction(current);
      const cycle = await runChapterCycle({
        projectPath: current.session.projectPath,
        chapterId,
        instruction,
        assetCards: current.planningBaseline.fields.asset_cards ?? [],
        worldSetting: current.planningBaseline.fields.world_setting ?? null,
      });

      const nextState = guidedNovelProjectStateSchema.parse({
        ...current,
        session: {
          ...current.session,
          status: 'chapter_review_pending',
          currentChapterId: chapterId,
          updatedAt: new Date().toISOString(),
        },
        currentTaskCard: cycle.taskCard,
        changeChecklist: cycle.checklist,
      });

      sessions.set(sessionId, nextState);
      return nextState;
    },

    approveChapter(sessionId: string): GuidedNovelProjectState {
      const current = sessions.get(sessionId);
      if (!current?.session) {
        throw new Error(`guided novel session not found: ${sessionId}`);
      }

      const nextState = guidedNovelProjectStateSchema.parse({
        ...current,
        session: {
          ...current.session,
          status: 'change_review_pending',
          updatedAt: new Date().toISOString(),
        },
      });

      sessions.set(sessionId, nextState);
      return nextState;
    },

    acceptChangeReview(sessionId: string, checklist?: unknown): GuidedNovelProjectState {
      const current = sessions.get(sessionId);
      if (!current?.session) {
        throw new Error(`guided novel session not found: ${sessionId}`);
      }

      const parsedChecklist = checklist
        ? guidedChangeChecklistSchema.parse(checklist)
        : current.changeChecklist ?? null;

      const nextState = guidedNovelProjectStateSchema.parse({
        ...current,
        changeChecklist: parsedChecklist,
        session: {
          ...current.session,
          status: 'ready_to_write',
          updatedAt: new Date().toISOString(),
        },
      });

      sessions.set(sessionId, nextState);
      return nextState;
    },

    get(sessionId: string): GuidedNovelProjectState | null {
      return sessions.get(sessionId) ?? null;
    },
  };
}

function nextChapterId(currentChapterId?: string | null) {
  const currentNumber = currentChapterId ? Number(currentChapterId.replace(/^chapter-/, '')) : 0;
  const nextNumber = Number.isFinite(currentNumber) && currentNumber > 0 ? currentNumber + 1 : 1;
  return `chapter-${nextNumber}`;
}

function buildChapterInstruction(state: GuidedNovelProjectState) {
  const fields = state.planningBaseline?.fields;
  const premise = fields?.creative_brief?.rawRequirement ?? fields?.world_setting?.premise ?? 'Advance the novel.';
  const conflict = fields?.outline_v2?.central_conflict;
  return conflict ? `${premise}\nFocus on: ${conflict}` : premise;
}
