import { z } from 'zod';
import { storyMemoryEntrySchema } from './story-memory';
import { fieldPatchEntrySchema } from './project-patch';

export const novelModelRefSchema = z.object({
  keyId: z.string().min(1),
  modelId: z.string().min(1),
});

export const novelModelRuntimeSchema = novelModelRefSchema.extend({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export type NovelModelRef = z.infer<typeof novelModelRefSchema>;
export type NovelModelRuntime = z.infer<typeof novelModelRuntimeSchema>;

// ── 章节候选补丁 ──

export const chapterCandidatePatchSchema = z.object({
  chapterId: z.string().min(1),
  runId: z.string().min(1),
  candidate: z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1),
    summary: z.string().min(1).optional(),
    wordCount: z.number().int().nonnegative().optional(),
  }),
});

export type ChapterCandidatePatch = z.infer<typeof chapterCandidatePatchSchema>;

// ── 章节生成请求 ──

export const novelChapterRunRequestSchema = z.object({
  projectPath: z.string().min(1),
  chapterId: z.string().min(1),
  mode: z.enum(['generate', 'continue', 'polish', 'review']),
  instruction: z.string().optional(),
  modelRuntime: novelModelRuntimeSchema.optional(),
});

export type NovelChapterRunRequest = z.infer<typeof novelChapterRunRequestSchema>;

// ── 章节生成结果 ──

export const novelChapterRunResultSchema = z.object({
  runId: z.string().min(1),
  chapterId: z.string().min(1),
  candidate: z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1),
    summary: z.string().min(1).optional(),
    wordCount: z.number().int().nonnegative().optional(),
  }),
  artifacts: z.object({
    reviewNotes: z.string().optional(),
    bridgeOutput: z.string().optional(),
  }).optional(),
});

export type NovelChapterRunResult = z.infer<typeof novelChapterRunResultSchema>;

// ── 故事同步输出 ──

export const novelStorySyncPayloadSchema = z.object({
  runId: z.string().min(1),
  chapterId: z.string().min(1),
  patches: z.array(fieldPatchEntrySchema),
  summary: z.string().min(1),
});

export type NovelStorySyncPayload = z.infer<typeof novelStorySyncPayloadSchema>;

// ── 记忆提取输出 ──

export const novelMemoryExtractionPayloadSchema = z.object({
  runId: z.string().min(1),
  chapterId: z.string().min(1),
  entries: z.array(storyMemoryEntrySchema),
});

export type NovelMemoryExtractionPayload = z.infer<typeof novelMemoryExtractionPayloadSchema>;

// ── Auto Mode ──

export const novelAutoModeStatusSchema = z.enum([
  'idle',
  'planning',
  'awaiting_approval',
  'running',
  'paused',
  'completed',
  'cancelled',
  'failed',
]);

export type NovelAutoModeStatus = z.infer<typeof novelAutoModeStatusSchema>;

export const novelAutoModePlanningSchema = z.object({
  status: z.enum(['not_started', 'generated', 'approved']).default('not_started'),
  bundlePath: z.string().min(1).optional(),
  artifactKeys: z.array(z.string().min(1)).default([]),
  generatedAt: z.string().datetime().optional(),
  approvedAt: z.string().datetime().optional(),
});

export type NovelAutoModePlanning = z.infer<typeof novelAutoModePlanningSchema>;

export const novelAutoModeStateSchema = z.object({
  autoModeId: z.string().min(1),
  projectPath: z.string().min(1),
  status: novelAutoModeStatusSchema,
  pendingChapterIds: z.array(z.string().min(1)),
  completedChapterIds: z.array(z.string().min(1)),
  currentChapterId: z.string().nullable(),
  currentRunId: z.string().nullable(),
  totalChapters: z.number().int().nonnegative(),
  startedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  lastError: z.string().nullable().default(null),
  mode: z.enum(['generate', 'continue', 'polish']).optional(),
  reviewMode: z.enum(['pass', 'revise', 'escalate']).optional(),
  plotSummary: z.string().optional(),
  modelRef: novelModelRefSchema.optional(),
  planning: novelAutoModePlanningSchema.optional(),
  schemaVersion: z.number().int().nonnegative().optional(),
});

export type NovelAutoModeState = z.infer<typeof novelAutoModeStateSchema>;

export const novelAutoModeStartRequestSchema = z.object({
  projectPath: z.string().min(1),
  chapterIds: z.array(z.string().min(1)).optional(),
  plotSummary: z.string().optional(),
  mode: z.enum(['generate', 'continue', 'polish']).default('generate'),
  modelRuntime: novelModelRuntimeSchema.optional(),
});

export type NovelAutoModeStartRequest = z.infer<typeof novelAutoModeStartRequestSchema>;

export const novelAutoModeActionSchema = z.object({
  autoModeId: z.string().min(1),
  action: z.enum(['approve_plan', 'pause', 'resume', 'cancel']),
});

export type NovelAutoModeAction = z.infer<typeof novelAutoModeActionSchema>;
