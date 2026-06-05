import { z } from 'zod';
import { creativeFieldKeySchema } from './creative-fields';

/**
 * Patch target. Either a structured creative field, or 'overview' — the
 * project meta subset (name/logline/synopsis/genre/theme/tone) surfaced on
 * the Overview page. 'overview' is intentionally NOT a CreativeFieldKey: it
 * persists to project meta (json + yaml), not the creative-field store.
 */
export const patchFieldSchema = z.union([creativeFieldKeySchema, z.literal('overview')]);

export const fieldPatchEntrySchema = z.object({
  field: patchFieldSchema,
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
