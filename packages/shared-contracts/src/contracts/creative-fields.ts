import { z } from 'zod';

// ── Creative Field Key ──

export const creativeFieldKeys = [
  'creative_brief',
  'world_setting',
  'outline',
  'episode_outlines',
  'growth_curve',
  'pacing_curve',
  'emotion_curve',
  'asset_cards',
  'relationship_graph',
  'foreshadow_registry'
] as const;

export type CreativeFieldKey = (typeof creativeFieldKeys)[number];

export const creativeFieldKeySchema = z.enum(creativeFieldKeys);

// ── Field Metadata ──

export const fieldMetadataSchema = z.object({
  version: z.number().int().nonnegative(),
  source: z.enum(['user', 'agent', 'imported', 'sync']),
  locked: z.boolean().default(false),
  dependsOn: z
    .array(
      z.object({
        field: creativeFieldKeySchema,
        version: z.number().int().nonnegative()
      })
    )
    .default([]),
  stale: z.boolean().default(false),
  lastSyncedAt: z.string().datetime().optional()
});

// ── Creative Brief ──

export const creativeBriefSchema = z.object({
  genre: z.string().optional(),
  theme: z.string().optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  length: z.string().optional(),
  taboos: z.array(z.string()).default([]),
  userConstraints: z.array(z.string()).default([]),
  rawRequirement: z.string()
});

// ── World Setting 世设 ──

export const worldSettingSchema = z.object({
  premise: z.string().optional(),
  era: z.string().optional(),
  locations: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional()
  })).default([]),
  rules: z.array(z.string()).default([]),
  power_structures: z.array(z.string()).default([]),
  taboos: z.array(z.string()).default([]),
  visual_language: z.array(z.string()).default([]),
  tone_rules: z.array(z.string()).default([]),
  open_questions: z.array(z.string()).default([])
});
export type WorldSetting = z.infer<typeof worldSettingSchema>;

// ── Outline V2 总大纲 ──

export const outlineActV2Schema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().optional(),
  conflict: z.string().optional(),
  turning_point: z.string().optional(),
  cost: z.string().optional(),
  end_state: z.string().optional(),
  summary: z.string().optional()
});

export const outlineV2Schema = z.object({
  title: z.string().default(''),
  logline: z.string().optional(),
  theme: z.string().optional(),
  genre: z.string().optional(),
  central_conflict: z.string().optional(),
  acts: z.array(outlineActV2Schema).default([]),
  major_turning_points: z.array(z.string()).default([]),
  ending_direction: z.string().optional(),
  constraints: z.array(z.string()).default([])
});

// ── Episode Outlines 集纲 ──

export const episodeOutlineStatusSchema = z.enum(['planned', 'drafted', 'revised', 'locked']);

export const episodeOutlineSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  purpose: z.string().optional(),
  summary: z.string().optional(),
  core_event: z.string().optional(),
  character_progressions: z.array(z.object({
    characterId: z.string().min(1),
    from: z.string(),
    to: z.string()
  })).default([]),
  emotional_beats: z.array(z.string()).default([]),
  pacing_beats: z.array(z.string()).default([]),
  foreshadowing: z.array(z.string()).default([]),
  payoffs: z.array(z.string()).default([]),
  hook: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  status: episodeOutlineStatusSchema.default('planned')
});

export const episodeOutlinesSchema = z.array(episodeOutlineSchema);

// Foreshadow Registry

export const foreshadowStatusSchema = z.enum([
  'pending',
  'planted',
  'resolved',
  'partially_resolved',
  'abandoned'
]);

export const foreshadowSourceTypeSchema = z.enum(['manual', 'agent', 'analysis', 'imported']);

export const foreshadowCategorySchema = z.enum([
  'identity',
  'mystery',
  'item',
  'relationship',
  'event',
  'ability',
  'prophecy',
  'motif',
  'world_rule',
  'custom'
]);

export const foreshadowEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  hint_text: z.string().optional(),
  resolution_text: z.string().optional(),
  source_type: foreshadowSourceTypeSchema.default('agent'),
  source_memory_id: z.string().optional(),
  source_analysis_id: z.string().optional(),
  plant_ref: z.string().optional(),
  plant_index: z.number().int().nonnegative().optional(),
  target_resolve_ref: z.string().optional(),
  target_resolve_index: z.number().int().nonnegative().optional(),
  actual_resolve_ref: z.string().optional(),
  actual_resolve_index: z.number().int().nonnegative().optional(),
  status: foreshadowStatusSchema.default('pending'),
  is_long_term: z.boolean().default(false),
  importance: z.number().min(0).max(1).default(0.5),
  strength: z.number().int().min(1).max(10).default(5),
  subtlety: z.number().int().min(1).max(10).default(5),
  urgency: z.number().int().min(0).max(3).default(0),
  related_asset_ids: z.array(z.string()).default([]),
  related_foreshadow_ids: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  category: foreshadowCategorySchema.optional(),
  notes: z.string().optional(),
  resolution_notes: z.string().optional(),
  auto_remind: z.boolean().default(true),
  remind_before_units: z.number().int().min(1).max(20).default(5),
  include_in_context: z.boolean().default(true),
  sourceRefs: z.array(z.string()).default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  planted_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().optional()
});

export const foreshadowRegistrySchema = z.object({
  items: z.array(foreshadowEntrySchema).default([]),
  version: z.number().int().nonnegative().default(0),
  updatedBy: z.enum(['user', 'agent', 'sync']).default('agent')
});

export type ForeshadowEntry = z.infer<typeof foreshadowEntrySchema>;
export type ForeshadowRegistry = z.infer<typeof foreshadowRegistrySchema>;

// ── Growth Curve 成长曲线 ──

export const growthCurvePointSchema = z.object({
  turning_point: z.string(),
  linked_episode_ids: z.array(z.string()).default([])
});

export const growthCurveSchema = z.object({
  character_id: z.string().min(1),
  start_state: z.string(),
  wound_or_lack: z.string().optional(),
  desire: z.string().optional(),
  need: z.string().optional(),
  turning_points: z.array(growthCurvePointSchema).default([]),
  regressions: z.array(z.string()).default([]),
  end_state: z.string().optional(),
  linked_episode_ids: z.array(z.string()).default([])
});

// ── Pacing Curve 节奏曲线 ──

export const pacingPointSchema = z.object({
  refId: z.string().min(1),
  intensity: z.number().min(0).max(10),
  informationDensity: z.number().min(0).max(10).optional(),
  actionLevel: z.number().min(0).max(10).optional(),
  recoveryLevel: z.number().min(0).max(10).optional(),
  note: z.string().optional()
});

export const pacingCurveSchema = z.object({
  unit: z.enum(['act', 'episode', 'chapter', 'scene']),
  points: z.array(pacingPointSchema).default([]),
  target_shape: z.string().optional(),
  risks: z.array(z.string()).default([])
});

// ── Emotion Curve 情感曲线 ──

export const emotionPointSchema = z.object({
  refId: z.string().min(1),
  primaryEmotion: z.string(),
  secondaryEmotion: z.string().optional(),
  valence: z.number().min(-1).max(1).optional(),
  arousal: z.number().min(0).max(1).optional(),
  transition: z.string().optional(),
  note: z.string().optional()
});

export const emotionCurveSchema = z.object({
  unit: z.enum(['act', 'episode', 'chapter', 'scene']),
  points: z.array(emotionPointSchema).default([]),
  emotional_promises: z.array(z.string()).default([]),
  catharsis_points: z.array(z.string()).default([])
});

// ── Asset Cards 资产卡 ──

export const assetCardTypeSchema = z.enum([
  'character', 'location', 'prop', 'organization', 'rule', 'visual_motif', 'lore'
]);

export const assetCardStatusSchema = z.enum(['draft', 'active', 'deprecated', 'locked']);

export const supportedAssetArchiveTypes = ['character', 'location', 'prop'] as const;
export const supportedAssetArchiveTypeSchema = z.enum(supportedAssetArchiveTypes);

export const assetArchiveSchema = z.object({
  path: z.string().min(1),
  slug: z.string().min(1),
  schemaVersion: z.number().int().positive().default(1),
});

export const assetImageKindSchema = z.enum([
  'primary',
  'portrait',
  'full_body',
  'scene_reference',
  'prop_detail',
  'costume',
  'mood',
]);

export const assetGalleryImageSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  kind: assetImageKindSchema,
  prompt: z.string().optional(),
  model: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const assetVisualsSchema = z.object({
  primaryImage: z.string().optional(),
  gallery: z.array(assetGalleryImageSchema).default([]),
});

export const assetRegistryEntrySchema = z.object({
  id: z.string().min(1),
  type: supportedAssetArchiveTypeSchema,
  name: z.string().min(1),
  summary: z.string().optional(),
  status: assetCardStatusSchema.default('draft'),
  tags: z.array(z.string()).default([]),
  archivePath: z.string().min(1),
  primaryImage: z.string().optional(),
});

export const assetRegistrySchema = z.object({
  items: z.array(assetRegistryEntrySchema).default([]),
  updatedAt: z.string().datetime().optional(),
});

export const assetCardSchema = z.object({
  id: z.string().min(1),
  type: assetCardTypeSchema,
  name: z.string().min(1),
  summary: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  archive: assetArchiveSchema.optional(),
  visuals: assetVisualsSchema.optional(),
  tags: z.array(z.string()).default([]),
  relationships: z.array(z.object({
    targetId: z.string().min(1),
    relationType: z.string(),
    label: z.string().optional()
  })).default([]),
  firstAppearance: z.string().optional(),
  sourceRefs: z.array(z.string()).default([]),
  status: assetCardStatusSchema.default('draft'),
  locked: z.boolean().default(false),
});

export const assetCardsSchema = z.array(assetCardSchema);
export type AssetCard = z.infer<typeof assetCardSchema>;
export type AssetCards = z.infer<typeof assetCardsSchema>;

// ── Relationship Graph 人物关系网 ──

export const relationTypeSchema = z.enum([
  'family', 'alliance', 'romance', 'rivalry', 'mentor',
  'secret', 'debt', 'organization', 'custom'
]);

export const relationshipNodeSchema = z.object({
  id: z.string().min(1),
  assetCardId: z.string().min(1),
  label: z.string(),
  type: assetCardTypeSchema,
  locked: z.boolean().default(false)
});

export const relationshipEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  relationType: relationTypeSchema,
  label: z.string().optional(),
  strength: z.number().min(0).max(10).optional(),
  polarity: z.enum(['positive', 'negative', 'neutral', 'ambivalent']).optional(),
  visibility: z.enum(['public', 'secret', 'one_sided']).optional(),
  sourceRefs: z.array(z.string()).default([]),
  locked: z.boolean().default(false)
});

export const relationshipGraphSchema = z.object({
  nodes: z.array(relationshipNodeSchema).default([]),
  edges: z.array(relationshipEdgeSchema).default([]),
  layout: z.record(z.string(), z.unknown()).optional(),
  version: z.number().int().nonnegative().default(0),
  updatedBy: z.enum(['user', 'agent', 'sync']).default('agent')
});
export type RelationshipGraph = z.infer<typeof relationshipGraphSchema>;

export const guidedPlanningBaselineFieldsSchema = z.object({
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
});
