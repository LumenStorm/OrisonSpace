import { z } from 'zod';
import { creativeFieldKeySchema } from './creative-fields';

export const fieldPatchEntrySchema = z.object({
  field: creativeFieldKeySchema,
  action: z.enum(['set', 'merge', 'delete']),
  data: z.unknown(),
  fieldVersion: z.number().int().nonnegative(),
  generatedBy: z.string().min(1)
});

export const projectFieldPatchSchema = z.object({
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  patches: z.array(fieldPatchEntrySchema)
});

export type ProjectFieldPatch = z.infer<typeof projectFieldPatchSchema>;
export type FieldPatchEntry = z.infer<typeof fieldPatchEntrySchema>;
