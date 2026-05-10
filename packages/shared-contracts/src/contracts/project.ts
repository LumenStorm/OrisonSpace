import { z } from 'zod';
import {
  creativeBriefSchema,
  worldSettingSchema,
  outlineV2Schema,
  episodeOutlinesSchema,
  growthCurveSchema,
  pacingCurveSchema,
  emotionCurveSchema,
  assetCardsSchema,
  assetRegistrySchema,
  relationshipGraphSchema,
  foreshadowRegistrySchema,
  fieldMetadataSchema,
  creativeFieldKeySchema
} from './creative-fields';
import { guidedNovelProjectStateSchema, guidedPlanningBaselineSchema } from './guided-novel';

// ── Meta ──

export const projectType = z.enum(['novel', 'script']);

export const projectMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: projectType,
  version: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// ── Outline ──
// @deprecated — Use outlineV2Schema from creative-fields.ts instead.
// Kept for backward compatibility with existing project files.

export const beatSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['setup', 'confrontation', 'resolution', 'twist', 'climax']).optional()
});

export const actSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  conflict_level: z.number().int().min(1).max(10).optional(),
  pacing: z.number().int().min(1).max(10).optional(),
  beats: z.array(beatSchema).optional()
});

export const outlineStyleSchema = z.object({
  visual_style: z.string().optional(),
  narrative_style: z.string().optional(),
  pacing: z.string().optional(),
  reference: z.string().optional()
});

export const outlineSchema = z.object({
  title: z.string().default(''),
  logline: z.string().optional(),
  genre: z.string().optional(),
  theme: z.string().optional(),
  style: outlineStyleSchema.optional(),
  acts: z.array(actSchema)
});

// ── Detailed Outline ──

export const sceneBriefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  characters: z.array(z.string()).optional(),
  location_id: z.string().optional(),
  notes: z.string().optional()
});

export const actDetailSchema = z.object({
  act_id: z.string().min(1),
  scene_briefs: z.array(sceneBriefSchema)
});

export const detailedOutlineSchema = z.object({
  act_details: z.array(actDetailSchema)
});

// ── Novel ──

export const chapterStatusSchema = z.enum(['draft', 'generating', 'revised', 'final']);

export const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sort_order: z.number().int(),
  act_id: z.string().optional(),
  summary: z.string().optional(),
  content_file: z.string().min(1),
  word_count: z.number().int().nonnegative().optional(),
  status: chapterStatusSchema.optional(),
  last_run_id: z.string().optional(),
  generated_at: z.string().datetime().optional(),
  bridge_notes: z.string().optional(),
});

export const novelSchema = z.object({
  chapters: z.array(chapterSchema)
});

// ── Script ──

export const dialogueSchema = z.object({
  id: z.string().min(1),
  character_id: z.string().min(1),
  line: z.string().min(1),
  direction: z.string().optional(),
  emotion: z.string().optional()
});

export const sceneStatusSchema = z.enum(['draft', 'revised', 'final']);

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sort_order: z.number().int(),
  act_id: z.string().optional(),
  summary: z.string().optional(),
  content_file: z.string().min(1),
  location_id: z.string().optional(),
  time_of_day: z.string().optional(),
  status: sceneStatusSchema.optional(),
  dialogues: z.array(dialogueSchema).optional()
});

export const scriptSchema = z.object({
  scenes: z.array(sceneSchema)
});

// ── Storyboard ──

export const sourceRefSchema = z.object({
  module: z.enum(['novel', 'script']),
  entity_id: z.string().min(1)
});

export const shotSchema = z.object({
  id: z.string().min(1),
  sort_order: z.number().int(),
  source_ref: sourceRefSchema.optional(),
  description: z.string().min(1),
  image_prompt: z.string().optional(),
  image_url: z.string().optional(),
  duration: z.number().positive().optional(),
  camera_lens: z.enum(['macro', 'portrait', 'wide', 'ultra_wide']).optional(),
  camera_movement: z.string().optional(),
  aspect_ratio: z.enum(['16:9', '2.35:1', '4:3']).optional(),
  lighting_mood: z.enum(['natural', 'golden_hour', 'noir', 'cinematic_blue']).optional()
});

export const storyboardSchema = z.object({
  shots: z.array(shotSchema)
});

// ── Video ──

export const clipStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);

export const clipSchema = z.object({
  id: z.string().min(1),
  shot_id: z.string().min(1),
  sort_order: z.number().int(),
  start_time: z.number().nonnegative(),
  end_time: z.number().nonnegative(),
  video_url: z.string().optional(),
  status: clipStatusSchema.optional()
});

export const videoSchema = z.object({
  clips: z.array(clipSchema)
});

// ── Assets ──

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  appearance: z.string().optional(),
  personality: z.string().optional()
});

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional()
});

export const assetsSchema = z.object({
  characters: z.array(characterSchema),
  locations: z.array(locationSchema)
});

// ── ProjectDocument ──

export const projectDocumentSchema = z.object({
  meta: projectMetaSchema,
  /** @deprecated Use outline_v2 instead. Kept for migration compatibility. */
  outline: outlineSchema,
  detailed_outline: detailedOutlineSchema.optional(),
  novel: novelSchema.optional(),
  script: scriptSchema.optional(),
  storyboard: storyboardSchema,
  video: videoSchema.optional(),
  assets: assetsSchema.optional(),
  // Phase 2: 新创作字段（全部可选，保持旧文档兼容）
  creative_brief: creativeBriefSchema.optional(),
  world_setting: worldSettingSchema.optional(),
  outline_v2: outlineV2Schema.optional(),
  episode_outlines: episodeOutlinesSchema.optional(),
  growth_curve: growthCurveSchema.optional(),
  pacing_curve: pacingCurveSchema.optional(),
  emotion_curve: emotionCurveSchema.optional(),
  asset_registry: assetRegistrySchema.optional(),
  asset_cards: assetCardsSchema.optional(),
  relationship_graph: relationshipGraphSchema.optional(),
  foreshadow_registry: foreshadowRegistrySchema.optional(),
  field_metadata: z.record(creativeFieldKeySchema, fieldMetadataSchema).optional()
});

export const projectGuidedNovelStateSchema = guidedNovelProjectStateSchema;
export const projectGuidedPlanningBaselineSchema = guidedPlanningBaselineSchema;
