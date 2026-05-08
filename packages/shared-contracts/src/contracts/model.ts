import { z } from 'zod';

export const modelCapabilitySchema = z.enum(['text', 'image', 'video']);

export const discoveredModelSchema = z.object({
  id: z.string().min(1),
  capability: modelCapabilitySchema,
  alias: z.string().min(1),
  enabled: z.boolean(),
});

export const apiKeyConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export const apiKeyEntrySchema = apiKeyConfigSchema.extend({
  models: z.array(discoveredModelSchema),
});

export const modelConfigSchema = z.object({
  keys: z.array(apiKeyEntrySchema),
});

export type ModelCapability = z.infer<typeof modelCapabilitySchema>;
export type DiscoveredModel = z.infer<typeof discoveredModelSchema>;
export type ApiKeyConfig = z.infer<typeof apiKeyConfigSchema>;
export type ApiKeyEntry = z.infer<typeof apiKeyEntrySchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;

/**
 * Resolved model info passed within the desktop main process for generation.
 * Never serialised to the renderer or sent over the network.
 */
export type ResolvedModel = {
  keyId: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  capability: ModelCapability;
};

// ── Model registry types ──

export type ModelRegistryEntry = {
  pattern: string;
  capability: ModelCapability;
  alias: string;
};

export type ModelRegistry = {
  entries: ModelRegistryEntry[];
};
