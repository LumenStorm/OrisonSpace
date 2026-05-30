import { z } from 'zod';
import { structuredTagSchema, memoryImportanceSchema } from './memory-tags';

// ── Story Memory 条目 ──

export const storyMemoryEntrySchema = z.object({
  id: z.string().min(1),
  novelId: z.string().min(1),
  chapterId: z.string().min(1),
  chapterNumber: z.number().int().nonnegative(),
  memoryType: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  importanceScore: z.number().min(0).max(1).default(0.5),
  relatedCharacters: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  isForeshadow: z.boolean().default(false),
  sourceExcerpt: z.string().optional(),
  embeddingModel: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  embeddingDim: z.number().int().positive().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  // ── 标记召回系统字段 ──
  structuredTags: z.array(structuredTagSchema).optional(),
  importance: memoryImportanceSchema.optional(),
  recallBudget: z.number().int().nonnegative().optional(),
});

export type StoryMemoryEntry = z.infer<typeof storyMemoryEntrySchema>;

// ── Story Memory 索引 ──

export const storyMemoryIndexSchema = z.object({
  novelId: z.string().min(1),
  entries: z.array(storyMemoryEntrySchema).default([]),
  version: z.number().int().nonnegative().default(0),
  updatedAt: z.string().datetime().optional(),
});

export type StoryMemoryIndex = z.infer<typeof storyMemoryIndexSchema>;