import { guidedPlanningBaselineSchema } from '@orison/shared-contracts';
import type { GuidedInterviewDraft, GuidedPlanningBaseline } from '@orison/shared-contracts';

export function createPlanningService() {
  return {
    buildBaseline(draft: GuidedInterviewDraft, version = 1): GuidedPlanningBaseline {
      const premise = asString(draft.concept.premise) ?? 'Guided novel premise';
      const genre = asString(draft.concept.genreHint);
      const coreConflict = asString(draft.plot.coreConflict);
      const toneRule = firstString(draft.constraints.mustHave);
      const protagonist = asRecord(draft.cast.protagonist);
      const protagonistLabel =
        asString(protagonist?.name) ?? asString(protagonist?.description) ?? 'Protagonist';

      return guidedPlanningBaselineSchema.parse({
        version,
        updatedAt: new Date().toISOString(),
        fields: {
          creative_brief: {
            genre,
            tone: toneRule,
            rawRequirement: premise,
            taboos: [],
            userConstraints: asStringArray(draft.constraints.mustHave),
          },
          world_setting: {
            premise,
            rules: asStringArray(draft.world.rules),
            locations: [],
            power_structures: [],
            taboos: [],
            visual_language: [],
            tone_rules: toneRule ? [toneRule] : [],
            open_questions: [],
          },
          outline_v2: {
            title: '',
            logline: premise,
            genre,
            central_conflict: coreConflict,
            acts: [],
            major_turning_points: [],
            constraints: asStringArray(draft.constraints.mustHave),
          },
          asset_cards: protagonistLabel
            ? [
                {
                  id: `guided_${slugify(protagonistLabel)}`,
                  type: 'character',
                  name: protagonistLabel,
                  summary: coreConflict,
                  tags: ['guided_novel'],
                  relationships: [],
                  sourceRefs: ['guided-novel:planning'],
                  status: 'draft',
                  locked: false,
                },
              ]
            : [],
        },
      });
    },
  };
}

function asString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function firstString(value: unknown) {
  return asStringArray(value)[0];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'protagonist';
}
