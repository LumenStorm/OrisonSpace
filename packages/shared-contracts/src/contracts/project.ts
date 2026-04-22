import { z } from 'zod';

export const projectDocumentSchema = z.object({
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().nonnegative()
  }),
  story: z.object({
    title: z.string().default(''),
    acts: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string().optional()
      })
    )
  }),
  script: z.object({
    scenes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string().optional()
      })
    )
  }),
  storyboard: z.object({
    shots: z.array(
      z.object({
        id: z.string(),
        description: z.string(),
        duration: z.number().optional()
      })
    )
  })
});
