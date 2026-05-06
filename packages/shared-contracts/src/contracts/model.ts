import { z } from 'zod';
import { generationProviderSchema, modelApiFormatSchema } from './generation';

/**
 * v2 model profile schema.
 *
 * One profile == one (baseUrl, apiKey) credential bundle plus a list of
 * concrete model entries. Each model entry carries its own `apiFormat`,
 * `alias`, and `capabilities`, so a single profile can serve `novel`,
 * `image`, and `video` slots simultaneously.
 *
 * `provider` decides how `/models` is listed when the user adds the profile.
 * `apiFormat` (per model entry) decides how generation requests are shaped.
 */
export const modelCapabilitySchema = z.enum(['text', 'image', 'video']);

export const modelEntrySchema = z.object({
  /** Real provider model id, e.g. `gpt-4o`, `claude-3-5-sonnet`, `gemini-2.5-pro`. */
  id: z.string().min(1),
  /** UI display name. Defaults to `id` if empty. */
  alias: z.string().min(1),
  apiFormat: modelApiFormatSchema,
  capabilities: z.array(modelCapabilitySchema).min(1),
});

export const modelProfileV2Schema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  name: z.string().min(1),
  provider: generationProviderSchema,
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  models: z.array(modelEntrySchema).min(1),
});

/**
 * Slot assignment for `novel` / `image` / `video`.
 *
 * Stored at `~/.orison/model/index.yaml`. Replaces the v1 `string | null`
 * shape. `null` means no slot assigned.
 */
export const slotAssignmentSchema = z.object({
  profileId: z.string().min(1),
  modelId: z.string().min(1),
});

export const slotAssignmentMapSchema = z.object({
  novel: slotAssignmentSchema.nullable(),
  image: slotAssignmentSchema.nullable(),
  video: slotAssignmentSchema.nullable(),
});

/**
 * Resolved profile passed across the desktop main / packages boundary.
 *
 * Constructed inside `apps/desktop/shell/main` from a v2 profile + a chosen
 * model entry + decrypted `apiKey`. Never serialised to the renderer, never
 * sent over the network: only travels function-call-to-function-call inside
 * the desktop main process.
 */
export const resolvedModelProfileSchema = z.object({
  profileId: z.string().min(1),
  modelId: z.string().min(1),
  apiFormat: modelApiFormatSchema,
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  /** Carried verbatim from the model entry. */
  capabilities: z.array(modelCapabilitySchema).min(1),
  /** Optional protocol-specific options. */
  providerOptions: z.record(z.unknown()).optional(),
});

export const modelConfigV2Schema = z.object({
  schemaVersion: z.literal(2),
  profiles: z.array(modelProfileV2Schema),
  selected: slotAssignmentMapSchema,
});

export type ModelCapability = z.infer<typeof modelCapabilitySchema>;
export type ModelEntry = z.infer<typeof modelEntrySchema>;
export type ModelProfileV2 = z.infer<typeof modelProfileV2Schema>;
export type SlotAssignment = z.infer<typeof slotAssignmentSchema>;
export type SlotAssignmentMap = z.infer<typeof slotAssignmentMapSchema>;
export type ResolvedModelProfile = z.infer<typeof resolvedModelProfileSchema>;
export type ModelConfigV2 = z.infer<typeof modelConfigV2Schema>;
