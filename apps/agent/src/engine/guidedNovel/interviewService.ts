import {
  guidedInterviewDraftSchema,
  guidedInterviewStateSchema,
} from '@orison/shared-contracts';
import type { GuidedInterviewDraft, GuidedInterviewState } from '@orison/shared-contracts';

const DEFAULT_GAPS = [
  { key: 'concept', prompt: 'What is the one-line story premise?', reason: 'Need a clear premise.' },
  { key: 'cast', prompt: 'Who is the core protagonist or ensemble?', reason: 'Need a cast anchor.' },
  { key: 'world', prompt: 'What makes the world distinct?', reason: 'Need world rules or atmosphere.' },
  { key: 'plot', prompt: 'What conflict drives the book forward?', reason: 'Need a central conflict.' },
  { key: 'constraints', prompt: 'Any must-have tone or constraints?', reason: 'Need writing constraints.' },
] as const;

export function createInterviewService() {
  return {
    createInitialState(): GuidedInterviewState {
      return guidedInterviewStateSchema.parse({
        stage: 'concept',
        questionCount: 1,
        messages: [
          {
            id: 'assistant_1',
            role: 'assistant',
            content:
              'Let us build the novel together. What is the genre, emotional tone, and one-line premise you want to pursue?',
            createdAt: new Date().toISOString(),
          },
        ],
        missing: DEFAULT_GAPS,
        draft: emptyDraft(),
      });
    },

    appendAnswer(state: GuidedInterviewState, answer: string): GuidedInterviewState {
      const now = new Date().toISOString();
      const nextDraft = summarizeInterviewIntoDraft(answer, state.draft);
      const nextMissing = computeMissingInformation(nextDraft);
      const nextMessages = [
        ...state.messages,
        {
          id: `user_${state.messages.length + 1}`,
          role: 'user' as const,
          content: answer,
          createdAt: now,
        },
      ];

      if (nextMissing.length > 0) {
        nextMessages.push({
          id: `assistant_${nextMessages.length + 1}`,
          role: 'assistant',
          content: nextMissing[0].prompt,
          createdAt: now,
        });
      }

      return guidedInterviewStateSchema.parse({
        stage: nextMissing[0]?.key ?? 'ready',
        questionCount: state.questionCount + 1,
        messages: nextMessages,
        missing: nextMissing,
        draft: nextDraft,
      });
    },
  };
}

function emptyDraft(): GuidedInterviewDraft {
  return guidedInterviewDraftSchema.parse({
    concept: {},
    cast: {},
    world: {},
    plot: {},
    constraints: {},
    confidence: {
      concept: 0,
      cast: 0,
      world: 0,
      plot: 0,
      constraints: 0,
      canEnterPlanning: false,
    },
  });
}

function summarizeInterviewIntoDraft(answer: string, previous: GuidedInterviewDraft): GuidedInterviewDraft {
  const lower = answer.toLowerCase();
  const concept = {
    ...previous.concept,
    premise: asString(previous.concept.premise) ?? answer,
    genreHint: asString(previous.concept.genreHint) ?? inferGenre(answer),
  };
  const cast = {
    ...previous.cast,
    protagonist:
      asRecord(previous.cast.protagonist) ??
      inferProtagonist(answer),
  };
  const world = {
    ...previous.world,
    hook: asString(previous.world.hook) ?? inferWorldHook(answer),
    rules: asUnknownArray(previous.world.rules) ?? inferRules(answer),
  };
  const plot = {
    ...previous.plot,
    coreConflict: asString(previous.plot.coreConflict) ?? answer,
  };
  const constraints = {
    ...previous.constraints,
    mustHave: asUnknownArray(previous.constraints.mustHave) ?? inferConstraints(answer, lower),
  };

  const confidence = {
    concept: scoreSection(concept),
    cast: scoreSection(cast),
    world: scoreSection(world),
    plot: scoreSection(plot),
    constraints: scoreSection(constraints),
    canEnterPlanning: false,
  };
  confidence.canEnterPlanning =
    confidence.concept >= 0.55 &&
    confidence.cast >= 0.55 &&
    confidence.world >= 0.55 &&
    confidence.plot >= 0.55 &&
    confidence.constraints >= 0.55;

  return guidedInterviewDraftSchema.parse({
    concept,
    cast,
    world,
    plot,
    constraints,
    confidence,
  });
}

function computeMissingInformation(draft: GuidedInterviewDraft) {
  return DEFAULT_GAPS.filter((gap) => draft.confidence[gap.key] < 0.55);
}

function inferGenre(answer: string) {
  if (/noir|mystery|detective|thriller/i.test(answer)) return 'mystery';
  if (/fantasy|magic/i.test(answer)) return 'fantasy';
  if (/科幻|赛博|未来/.test(answer)) return 'science_fiction';
  return undefined;
}

function inferProtagonist(answer: string) {
  if (/detective/i.test(answer)) {
    return { archetype: 'detective', description: 'A lonely detective' };
  }
  if (/主角|主人公/.test(answer)) {
    return { archetype: 'protagonist', description: answer };
  }
  return undefined;
}

function inferWorldHook(answer: string) {
  if (/magic/i.test(answer)) return 'Magic shapes memory and consequence.';
  if (/city/i.test(answer) || /都市|城市/.test(answer)) return 'An atmospheric city drives the story mood.';
  return undefined;
}

function inferRules(answer: string) {
  if (/memory magic/i.test(answer)) return ['Memory magic has a personal cost.'];
  if (/magic/i.test(answer)) return ['Power requires a narrative cost.'];
  return undefined;
}

function inferConstraints(answer: string, lower: string) {
  const mustHave: string[] = [];
  if (lower.includes('noir')) mustHave.push('Preserve a noir emotional texture.');
  if (/slow burn|slow-burn/i.test(answer)) mustHave.push('Keep a slow-burn progression.');
  return mustHave.length > 0 ? mustHave : undefined;
}

function scoreSection(section: Record<string, unknown>) {
  return Object.keys(section).length > 0 ? 0.7 : 0;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asUnknownArray(value: unknown) {
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}
