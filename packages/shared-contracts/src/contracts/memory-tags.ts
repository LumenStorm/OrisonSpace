import { z } from 'zod';

// ── 标签分类 ──

export const tagCategorySchema = z.enum([
  'character', 'event', 'foreshadow', 'setting', 'location', 'item', 'emotion', 'power'
]);
export type TagCategory = z.infer<typeof tagCategorySchema>;

// ── 结构化标签 ──

export const structuredTagSchema = z.object({
  category: tagCategorySchema,
  value: z.string().min(1),
  role: z.enum(['subject', 'object', 'context']).default('context'),
});
export type StructuredTag = z.infer<typeof structuredTagSchema>;

// ── 标签注册表条目 ──

export const tagRegistryEntrySchema = z.object({
  id: z.string().min(1),
  category: tagCategorySchema,
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  lastSeenChapter: z.number().int().nonnegative().default(0),
});
export type TagRegistryEntry = z.infer<typeof tagRegistryEntrySchema>;

// ── 标签注册表 ──

export const tagRegistrySchema = z.object({
  novelId: z.string().min(1),
  entries: z.array(tagRegistryEntrySchema).default([]),
  version: z.number().int().nonnegative().default(0),
});
export type TagRegistry = z.infer<typeof tagRegistrySchema>;

// ── 记忆重要度 ──

export const memoryImportanceSchema = z.enum(['critical', 'high', 'medium', 'low']);
export type MemoryImportance = z.infer<typeof memoryImportanceSchema>;
