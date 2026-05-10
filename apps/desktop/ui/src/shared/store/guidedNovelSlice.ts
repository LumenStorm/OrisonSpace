import type { CreativeFieldKey } from '@orison/shared-contracts';
import type { StateCreator } from 'zustand';
import type {
  AssetCard,
  GuidedChangeChecklist,
  GuidedImpactReview,
  GuidedNovelProjectState,
} from '@orison/shared-contracts';
import {
  acceptGuidedNovelChangeReview,
  advanceGuidedNovelToNextChapter,
  approveGuidedNovelChapter,
  startGuidedNovelSession,
  submitGuidedNovelInterviewAnswer,
} from '../api/guidedNovel';

const ERROR_KEY_START = 'guidedNovel.startFailed';
const ERROR_KEY_ANSWER = 'guidedNovel.answerFailed';
const ERROR_KEY_ADVANCE = 'guidedNovel.advanceFailed';
const ERROR_KEY_APPROVE = 'guidedNovel.approveFailed';
const ERROR_KEY_ACCEPT = 'guidedNovel.acceptFailed';
const ERROR_KEY_UNKNOWN = 'guidedNovel.unknownError';

function persistGuidedNovelState(state: GuidedNovelProjectState | null, projectPath?: string) {
  const resolvedProjectPath = projectPath ?? state?.session?.projectPath;
  if (!resolvedProjectPath || !state || !window.orisonDesktop?.saveGuidedNovelState) return;
  window.orisonDesktop.saveGuidedNovelState(resolvedProjectPath, state).catch(() => {});
}

function toErrorKey(error: unknown, fallbackPrefix: string): string {
  if (error instanceof Error && error.message.startsWith(fallbackPrefix)) {
    return error.message;
  }
  return error instanceof Error ? error.message : ERROR_KEY_UNKNOWN;
}

export type GuidedNovelSlice = {
  guidedNovelState: GuidedNovelProjectState | null;
  guidedNovelLoading: boolean;
  guidedNovelError: string | null;
  setGuidedNovelState: (state: GuidedNovelProjectState | null) => void;
  startGuidedNovelSession: () => Promise<void>;
  submitGuidedNovelAnswer: (answer: string) => Promise<void>;
  enterGuidedPlanning: () => void;
  confirmGuidedBaseline: () => Promise<void>;
  enterGuidedChapterReview: (payload?: {
    chapterTitle?: string;
    chapterSummary?: string;
    chapterText?: string;
  }) => void;
  approveGuidedChapter: () => Promise<void>;
  setGuidedChangeChecklist: (checklist: GuidedChangeChecklist) => void;
  acceptGuidedChanges: () => Promise<void>;
  setGuidedImpactReview: (review: GuidedImpactReview) => void;
  chooseGuidedImpactAction: (action: 'continue' | 'replan') => void;
};

type GuidedNovelSliceDeps = GuidedNovelSlice & {
  currentProject: { path: string } | null;
  creativeFields: Partial<Record<CreativeFieldKey, unknown>>;
  updateField: (field: CreativeFieldKey, data: unknown) => void;
};

type GuidedCreativeFields = Partial<Record<CreativeFieldKey, unknown>>;

export const createGuidedNovelSlice: StateCreator<
  GuidedNovelSliceDeps,
  [],
  [],
  GuidedNovelSlice
> = (set, get) => ({
  guidedNovelState: null,
  guidedNovelLoading: false,
  guidedNovelError: null,

  setGuidedNovelState: (state) => set({ guidedNovelState: state }),

  async startGuidedNovelSession() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) return;
    set({ guidedNovelLoading: true, guidedNovelError: null });
    try {
      const state = await startGuidedNovelSession(projectPath);
      set({ guidedNovelState: state, guidedNovelLoading: false });
      persistGuidedNovelState(state, projectPath);
    } catch (error) {
      set({
        guidedNovelError: toErrorKey(error, 'startGuidedNovelSession:') || ERROR_KEY_START,
        guidedNovelLoading: false,
      });
    }
  },

  async submitGuidedNovelAnswer(answer) {
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) return;
    const current = get().guidedNovelState;
    const projectPath = current?.session?.projectPath ?? get().currentProject?.path;
    let sessionId = current?.session?.sessionId;
    if (!sessionId && !projectPath) {
      set({ guidedNovelError: ERROR_KEY_START });
      return;
    }
    set({ guidedNovelLoading: true, guidedNovelError: null });
    try {
      if (!sessionId) {
        const initialState = await startGuidedNovelSession(projectPath!);
        sessionId = initialState.session?.sessionId;
        if (!sessionId) {
          throw new Error(ERROR_KEY_START);
        }
        set({ guidedNovelState: initialState });
      }
      const state = await submitGuidedNovelInterviewAnswer(sessionId, trimmedAnswer);
      set({ guidedNovelState: state, guidedNovelLoading: false });
      persistGuidedNovelState(state, projectPath);
    } catch (error) {
      set({
        guidedNovelError: toErrorKey(error, 'submitGuidedNovelInterviewAnswer:') || ERROR_KEY_ANSWER,
        guidedNovelLoading: false,
      });
    }
  },

  enterGuidedPlanning() {
    const current = get().guidedNovelState;
    if (!current?.session) return;
    const nextState = {
      ...current,
      session: {
        ...current.session,
        status: 'planning' as const,
      },
    };
    set({
      guidedNovelState: nextState,
    });
    persistGuidedNovelState(nextState);
  },

  async confirmGuidedBaseline() {
    const current = get().guidedNovelState;
    const sessionId = current?.session?.sessionId;
    if (!sessionId) return;
    set({ guidedNovelLoading: true, guidedNovelError: null });
    try {
      const state = await advanceGuidedNovelToNextChapter(sessionId);
      set({ guidedNovelState: state, guidedNovelLoading: false });
      persistGuidedNovelState(state);
    } catch (error) {
      set({
        guidedNovelError: toErrorKey(error, 'advanceGuidedNovelToNextChapter:') || ERROR_KEY_ADVANCE,
        guidedNovelLoading: false,
      });
    }
  },

  enterGuidedChapterReview(payload) {
    const current = get().guidedNovelState;
    if (!current?.session) return;
    const nextState = {
      ...current,
      session: {
        ...current.session,
        status: 'chapter_review_pending' as const,
      },
      currentTaskCard: {
        chapterId: current.session.currentChapterId ?? 'chapter-next',
        title: payload?.chapterTitle,
        summary: payload?.chapterSummary ?? 'Review the generated chapter before continuing.',
        goal: payload?.chapterSummary,
        storyBeats: [],
        involvedAssetIds: [],
      },
    };
    set({
      guidedNovelState: nextState,
    });
    persistGuidedNovelState(nextState);
  },

  async approveGuidedChapter() {
    const current = get().guidedNovelState;
    const sessionId = current?.session?.sessionId;
    if (!sessionId) return;
    set({ guidedNovelLoading: true, guidedNovelError: null });
    try {
      const state = await approveGuidedNovelChapter(sessionId);
      set({ guidedNovelState: state, guidedNovelLoading: false });
      persistGuidedNovelState(state);
    } catch (error) {
      set({
        guidedNovelError: toErrorKey(error, 'approveGuidedNovelChapter:') || ERROR_KEY_APPROVE,
        guidedNovelLoading: false,
      });
    }
  },

  setGuidedChangeChecklist(checklist) {
    const current = get().guidedNovelState;
    if (!current?.session) return;
    const nextState = {
      ...current,
      changeChecklist: checklist,
      session: {
        ...current.session,
        status: 'change_review_pending' as const,
      },
    };
    set({
      guidedNovelState: nextState,
    });
    persistGuidedNovelState(nextState);
  },

  async acceptGuidedChanges() {
    const current = get().guidedNovelState;
    const checklist = current?.changeChecklist;
    const sessionId = current?.session?.sessionId;
    if (!sessionId || !checklist) return;

    const nextFields = applyAcceptedGuidedChanges(get().creativeFields, checklist);
    set({ guidedNovelLoading: true, guidedNovelError: null });
    try {
      const state = await acceptGuidedNovelChangeReview(sessionId, checklist);
      const fieldKeys: CreativeFieldKey[] = ['asset_cards', 'world_setting', 'relationship_graph'];

      for (const field of fieldKeys) {
        if (nextFields[field] !== undefined) {
          get().updateField(field, nextFields[field]);
        }
      }

      const nextState = {
          ...state,
          impactReview: current.impactReview,
          session: {
            ...state.session!,
            status: current.impactReview ? 'impact_review_pending' : state.session!.status,
          },
        };
      set({
        guidedNovelState: nextState,
        guidedNovelLoading: false,
      });
      persistGuidedNovelState(nextState);
    } catch (error) {
      set({
        guidedNovelError: toErrorKey(error, 'acceptGuidedNovelChangeReview:') || ERROR_KEY_ACCEPT,
        guidedNovelLoading: false,
      });
    }
  },

  setGuidedImpactReview(review) {
    const current = get().guidedNovelState;
    if (!current?.session) return;
    const nextState = {
      ...current,
      impactReview: review,
      session: {
        ...current.session,
        status: 'impact_review_pending' as const,
      },
    };
    set({
      guidedNovelState: nextState,
    });
    persistGuidedNovelState(nextState);
  },

  chooseGuidedImpactAction(action) {
    const current = get().guidedNovelState;
    if (!current?.session) return;
    const nextState = {
      ...current,
      session: {
        ...current.session,
        status: action === 'replan' ? 'replanning' as const : 'ready_to_write' as const,
      },
    };
    set({
      guidedNovelState: nextState,
    });
    persistGuidedNovelState(nextState);
  },
});

export function applyAcceptedGuidedChanges(
  current: GuidedCreativeFields,
  checklist: GuidedChangeChecklist,
): GuidedCreativeFields {
  const nextCards = Array.isArray(current.asset_cards)
    ? [...(current.asset_cards as AssetCard[])]
    : [];
  const nextWorld = isRecord(current.world_setting) ? { ...current.world_setting } : undefined;
  const nextRelationshipGraph = isRecord(current.relationship_graph)
    ? { ...current.relationship_graph }
    : undefined;

  for (const item of checklist.items) {
    if (!['accepted', 'edited', 'merged'].includes(item.decision)) continue;

    if (
      (item.type === 'new_character' || item.type === 'new_location' || item.type === 'new_prop') &&
      item.suggestedOperation === 'create'
    ) {
      const payload = item.payload as Partial<AssetCard>;
      if (!payload.id || !payload.name || !payload.type) continue;
      if (!nextCards.some((card) => card.id === payload.id)) {
        nextCards.push({
          id: payload.id,
          type: payload.type,
          name: payload.name,
          summary: payload.summary,
          details: payload.details,
          archive: payload.archive,
          visuals: payload.visuals,
          tags: payload.tags ?? [],
          relationships: payload.relationships ?? [],
          firstAppearance: payload.firstAppearance,
          sourceRefs: payload.sourceRefs ?? ['guided-novel:change-review'],
          status: payload.status ?? 'draft',
          locked: payload.locked ?? false,
        });
      }
    }

    if (item.type === 'setting_update' && nextWorld && isRecord(item.payload)) {
      Object.assign(nextWorld, item.payload);
    }

    if (item.type === 'relationship_update' && nextRelationshipGraph && isRecord(item.payload)) {
      Object.assign(nextRelationshipGraph, item.payload);
    }
  }

  return {
    ...current,
    asset_cards: nextCards,
    ...(nextWorld ? { world_setting: nextWorld } : {}),
    ...(nextRelationshipGraph ? { relationship_graph: nextRelationshipGraph } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
