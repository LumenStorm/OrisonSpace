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
