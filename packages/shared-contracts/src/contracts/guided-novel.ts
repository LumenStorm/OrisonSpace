import { z } from 'zod';
import { guidedPlanningBaselineFieldsSchema } from './creative-fields';

const guidedSectionSchema = z.record(z.string(), z.unknown());

export const guidedWorkflowStatusSchema = z.enum([
  'idle',
  'interviewing',
  'planning',
  'ready_to_write',
  'writing_chapter',
  'chapter_review_pending',
  'change_review_pending',
  'impact_review_pending',
  'replanning',
  'completed',
  'cancelled',
  'failed',
]);

export const guidedInterviewMessageRoleSchema = z.enum(['system', 'assistant', 'user']);

export const guidedInterviewMessageSchema = z.object({
  id: z.string().min(1).optional(),
  role: guidedInterviewMessageRoleSchema,
  content: z.string().min(1),
  createdAt: z.string().datetime().optional(),
});

export const guidedInterviewGapSchema = z.object({
  key: z.string().min(1),
  prompt: z.string().min(1),
  reason: z.string().optional(),
  required: z.boolean().default(true),
});

export const guidedInterviewDraftConfidenceSchema = z.object({
  concept: z.number().min(0).max(1),
  cast: z.number().min(0).max(1),
  world: z.number().min(0).max(1),
  plot: z.number().min(0).max(1),
  constraints: z.number().min(0).max(1),
  canEnterPlanning: z.boolean(),
});

export const guidedInterviewDraftSchema = z.object({
  concept: guidedSectionSchema.default({}),
  cast: guidedSectionSchema.default({}),
  world: guidedSectionSchema.default({}),
  plot: guidedSectionSchema.default({}),
  constraints: guidedSectionSchema.default({}),
  confidence: guidedInterviewDraftConfidenceSchema,
});

export const guidedInterviewStateSchema = z.object({
  stage: z.string().min(1).default('concept'),
  questionCount: z.number().int().nonnegative().default(0),
  messages: z.array(guidedInterviewMessageSchema).default([]),
  missing: z.array(guidedInterviewGapSchema).default([]),
  draft: guidedInterviewDraftSchema,
});

export const guidedNovelSessionSchema = z.object({
  sessionId: z.string().min(1),
  projectPath: z.string().min(1),
  status: guidedWorkflowStatusSchema,
  baselineVersion: z.number().int().nonnegative(),
  currentPhaseId: z.string().nullable().optional(),
  currentChapterId: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const guidedNovelStartRequestSchema = z.object({
  projectPath: z.string().min(1),
});

export const guidedNovelInterviewAnswerSchema = z.object({
  answer: z.string().min(1),
});

export const guidedChapterTaskCardSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().optional(),
  summary: z.string().min(1),
  goal: z.string().optional(),
  conflict: z.string().optional(),
  involvedAssetIds: z.array(z.string()).default([]),
  storyBeats: z.array(z.string()).default([]),
});

export const guidedChangeTypeSchema = z.enum([
  'new_character',
  'update_character',
  'new_location',
  'update_location',
  'new_prop',
  'update_prop',
  'setting_update',
  'relationship_update',
  'foreshadow_add',
  'foreshadow_payoff',
]);

export const guidedChangeSuggestedOperationSchema = z.enum([
  'create',
  'update',
  'merge',
  'flag_conflict',
]);

export const guidedChangeConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const guidedChangeDecisionSchema = z.enum([
  'pending',
  'accepted',
  'edited',
  'rejected',
  'merged',
]);

export const guidedChangeChecklistItemSchema = z.object({
  id: z.string().min(1),
  type: guidedChangeTypeSchema,
  sourceChapterId: z.string().min(1),
  sourceExcerpt: z.string().optional(),
  targetIds: z.array(z.string()).default([]),
  suggestedOperation: guidedChangeSuggestedOperationSchema,
  confidence: guidedChangeConfidenceSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  decision: guidedChangeDecisionSchema.default('pending'),
  notes: z.string().optional(),
});

export const guidedChangeChecklistSchema = z.object({
  chapterId: z.string().min(1),
  items: z.array(guidedChangeChecklistItemSchema).default([]),
});

export const guidedImpactRecommendationSchema = z.enum(['continue', 'replan']);

export const guidedImpactReviewSchema = z.object({
  triggerField: z.string().min(1),
  affectedPhaseIds: z.array(z.string()).default([]),
  affectedChapterIds: z.array(z.string()).default([]),
  affectedAssetIds: z.array(z.string()).default([]),
  summary: z.string().optional(),
  recommendation: guidedImpactRecommendationSchema,
});

export const guidedPlanningBaselineSchema = z.object({
  version: z.number().int().nonnegative(),
  fields: guidedPlanningBaselineFieldsSchema.default({}),
  updatedAt: z.string().datetime().optional(),
});

export const guidedNovelProjectStateSchema = z.object({
  session: guidedNovelSessionSchema.nullable().optional(),
  interviewState: guidedInterviewStateSchema.nullable().optional(),
  interviewDraft: guidedInterviewDraftSchema.nullable().optional(),
  planningBaseline: guidedPlanningBaselineSchema.nullable().optional(),
  currentTaskCard: guidedChapterTaskCardSchema.nullable().optional(),
  changeChecklist: guidedChangeChecklistSchema.nullable().optional(),
  impactReview: guidedImpactReviewSchema.nullable().optional(),
});

export type GuidedNovelSession = z.infer<typeof guidedNovelSessionSchema>;
export type GuidedInterviewState = z.infer<typeof guidedInterviewStateSchema>;
export type GuidedInterviewDraft = z.infer<typeof guidedInterviewDraftSchema>;
export type GuidedChapterTaskCard = z.infer<typeof guidedChapterTaskCardSchema>;
export type GuidedPlanningBaseline = z.infer<typeof guidedPlanningBaselineSchema>;
export type GuidedChangeChecklist = z.infer<typeof guidedChangeChecklistSchema>;
export type GuidedImpactReview = z.infer<typeof guidedImpactReviewSchema>;
export type GuidedNovelProjectState = z.infer<typeof guidedNovelProjectStateSchema>;
