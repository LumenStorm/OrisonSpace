import { z } from 'zod';

export const patchOperationSchema = z.object({
  op: z.enum(['replace', 'append']),
  path: z.string().min(1),
  value: z.unknown()
});

export const taskRequestSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.string().min(1),
  projectFingerprint: z.string().min(1),
  selectedScope: z.object({
    module: z.enum(['story', 'script', 'storyboard', 'video']),
    entityId: z.string().optional()
  }),
  contextPayload: z.record(z.string(), z.unknown()),
  userInstruction: z.string().min(1),
  privacyLevel: z.enum(['minimal', 'standard']),
  expectedOutputType: z.enum(['patch', 'candidate'])
});

export const taskResultSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  outputType: z.enum(['patch', 'candidate']).optional(),
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
