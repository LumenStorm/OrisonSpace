import { z } from 'zod';

export const patchOperationSchema = z.object({
  op: z.enum(['replace', 'append']),
  path: z.string().min(1),
  value: z.unknown()
});

export const projectIdSchema = z.string().regex(/^\d{5}$/);

export const taskRequestSchema = z.object({
  projectId: projectIdSchema,
  targetId: z.string().min(1).optional(),
  assetIds: z.array(z.string().min(1)).default([]),
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  input: z.string().min(1)
});

export const projectCreateRequestSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['novel', 'script']),
  localFingerprint: z.string().min(1)
});

export const projectCreateResponseSchema = z.object({
  projectId: projectIdSchema,
  name: z.string().min(1),
  type: z.enum(['novel', 'script'])
});

export const taskResultSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  outputType: z.enum(['patch', 'candidate', 'chapter_candidate']).optional(),
  outputPayload: z
    .object({
      operations: z.array(patchOperationSchema).default([])
    })
    .optional(),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  reviewHint: z.string().min(1),
  retryable: z.boolean()
});

/**
 * Persistence-layer upsert shapes for the desktop SQLite repositories. These
 * use free-string projectId (the local DB key), distinct from the 5-digit
 * registered `projectIdSchema`. Used to validate the task:/asset: IPC inputs.
 */
export const taskUpsertSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  taskType: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  errorMessage: z.string().optional(),
  outputPayload: z.string().optional()
});

export const assetUpsertSchema = z.object({
  assetId: z.string().min(1),
  projectId: z.string().min(1),
  assetType: z.string().min(1),
  assetName: z.string().min(1),
  assetGroup: z.string().optional(),
  assetStatus: z.string().optional(),
  relativePath: z.string().min(1),
  sourceTaskId: z.string().optional(),
  summary: z.string().optional()
});

export const assetUpdateSchema = z.object({
  projectId: z.string().min(1),
  assetId: z.string().min(1),
  fields: z.object({
    assetName: z.string().optional(),
    assetGroup: z.string().optional(),
    summary: z.string().optional(),
    assetStatus: z.string().optional(),
  })
});

export const assetDeleteSchema = z.object({
  projectId: z.string().min(1),
  assetId: z.string().min(1)
});

export const taskListItemSchema = z.object({
  taskId: z.string().min(1),
  projectId: projectIdSchema,
  targetId: z.string().min(1).optional(),
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  assetIds: z.array(z.string().min(1)).default([])
});

export const projectAssetListItemSchema = z.object({
  assetId: z.string().min(1),
  projectId: projectIdSchema,
  assetType: z.string().min(1),
  assetName: z.string().min(1),
  assetGroup: z.string().default(''),
  assetStatus: z.string().min(1),
  relativePath: z.string().default(''),
  sourceTaskId: z.string().min(1).optional(),
  summary: z.string().optional(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime()
});

export const taskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
  sort: z.enum(['createdDesc', 'createdAsc']).default('createdDesc')
});

export const projectAssetListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
  sort: z.enum(['updatedDesc', 'updatedAsc']).default('updatedDesc')
});

export const taskListResponseSchema = z.object({
  items: z.array(taskListItemSchema),
  nextCursor: z.string().nullable()
});

export const projectAssetListResponseSchema = z.object({
  items: z.array(projectAssetListItemSchema),
  nextCursor: z.string().nullable()
});

export const taskDetailResponseSchema = z.object({
  task: taskListItemSchema,
  result: taskResultSchema.nullable()
});
