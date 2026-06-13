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
  relationshipGraphSchema,
  foreshadowRegistrySchema,
  fieldMetadataSchema,
  creativeFieldKeySchema
} from './creative-fields';

// ── Meta ──

export const projectType = z.enum(['novel', 'script']);

export const projectMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: projectType,
  logline: z.string().optional(),
  synopsis: z.string().optional(),
  genre: z.string().optional(),
  theme: z.string().optional(),
  writing_style: z.string().optional(),
  tone: z.string().optional(),
  /** 封面图相对/绝对路径（从已废弃的 project.json 收敛而来）。 */
  cover_image: z.string().optional(),
  /** 本机注册表里的项目 ID（5 位注册号；从已废弃的 project.json 收敛而来）。 */
  project_id: z.string().optional(),
  version: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// ── Novel ──

export const chapterStatusSchema = z.enum(['draft', 'generating', 'revised', 'final']);

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  sort_order: z.number().int(),
  content_file: z.string().min(1),
  word_count: z.number().int().nonnegative().optional(),
});

export const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sort_order: z.number().int(),
  summary: z.string().optional(),
  summary_source: z.enum(['ai', 'user']).optional(),
  status: chapterStatusSchema.optional(),
  word_count: z.number().int().nonnegative().optional(),
  last_run_id: z.string().optional(),
  generated_at: z.string().datetime().optional(),
  sections: z.array(sectionSchema).default([]),
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
  aliases: z.array(z.string()).default([]),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  backstory: z.string().optional(),
  relationships: z.array(z.object({
    character_id: z.string().min(1),
    relation: z.string().min(1),
  })).default([]),
});

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional()
});

export const propSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional()
});

export const assetsSchema = z.object({
  characters: z.array(characterSchema).default([]),
  locations: z.array(locationSchema).default([]),
  props: z.array(propSchema).default([]),
});

// ── ProjectDocument ──

export const projectDocumentSchema = z.object({
  meta: projectMetaSchema,
  novel: novelSchema.optional(),
  script: scriptSchema.optional(),
  storyboard: storyboardSchema,
  video: videoSchema.optional(),
  assets: assetsSchema.optional(),
  // 创作字段
  creative_brief: creativeBriefSchema.optional(),
  world_setting: worldSettingSchema.optional(),
  outline_v2: outlineV2Schema.optional(),
  episode_outlines: episodeOutlinesSchema.optional(),
  growth_curve: growthCurveSchema.optional(),
  pacing_curve: pacingCurveSchema.optional(),
  emotion_curve: emotionCurveSchema.optional(),
  asset_cards: assetCardsSchema.optional(),
  relationship_graph: relationshipGraphSchema.optional(),
  foreshadow_registry: foreshadowRegistrySchema.optional(),
  field_metadata: z.record(creativeFieldKeySchema, fieldMetadataSchema).optional()
});
