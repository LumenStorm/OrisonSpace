import { z } from 'zod';

export const generationProviderSchema = z.enum(['openai', 'gcp', 'anthropic']);

/**
 * Wire-protocol selector for a single model.
 *
 * Decoupled from `provider` — a NewAPI relay may expose Claude models through
 * the OpenAI-compatible chat-completions protocol, in which case the profile
 * holds `provider='openai'` (drives the /models listing) but the model entry
 * holds `apiFormat='openai-chat-completions'`.
 *
 * `provider` decides how `/models` is listed; `apiFormat` decides how each
 * generation request is shaped.
 */
export const modelApiFormatSchema = z.enum([
  'openai-chat-completions',
  'openai-responses',
  'claude-messages',
  'gemini-generate-content',
  'openai-images',
  'gemini-images',
  'sora-videos',
]);

export const generationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const textGenerationRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(generationMessageSchema).min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  /** Selected at the model entry; optional during the migration window. */
  apiFormat: modelApiFormatSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  /**
   * Free-form passthrough for protocol-specific options that should not be
   * promoted to top-level fields (e.g. Claude `thinking`, OpenAI `tools`).
   * Adapters consume the subset they understand and ignore the rest.
   */
  providerOptions: z.record(z.unknown()).optional(),
});

export const textGenerationResponseSchema = z.object({
  provider: generationProviderSchema,
  model: z.string(),
  text: z.string(),
  raw: z.unknown().optional(),
});

export const imageGenerationRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  /** Selected at the model entry; optional during the migration window. */
  apiFormat: modelApiFormatSchema.optional(),
  size: z.string().optional(),
  n: z.number().int().min(1).max(10).optional(),
  /**
   * OpenAI image quality.
   * gpt-image-1: auto | low | medium | high
   * (dall-e-3: standard | hd — not exposed in this iteration)
   */
  quality: z.enum(['auto', 'low', 'medium', 'high']).optional(),
  /** gpt-image-1 only. Defaults to `auto`. */
  background: z.enum(['transparent', 'opaque', 'auto']).optional(),
  /** gpt-image-1 only. Defaults to `png`. */
  outputFormat: z.enum(['png', 'jpeg', 'webp']).optional(),
  /** gpt-image-1 only, only meaningful for jpeg/webp. 0–100. */
  outputCompression: z.number().int().min(0).max(100).optional(),
  /** gpt-image-1 only. */
  moderation: z.enum(['low', 'auto']).optional(),
  /** Optional end-user identifier forwarded for abuse monitoring. */
  user: z.string().optional(),
  /** Free-form passthrough for protocol-specific options. See textGenerationRequestSchema. */
  providerOptions: z.record(z.unknown()).optional(),
});

export const generatedImageSchema = z.object({
  url: z.string().optional(),
  b64Json: z.string().optional(),
  b64_json: z.string().optional(),
  base64: z.string().optional(),
  dataUrl: z.string().optional(),
  mimeType: z.string().optional(),
}).transform((image) => {
  const dataUrl = parseDataUrl(image.dataUrl);
  const payload =
    readBase64Payload(image.b64Json) ??
    readBase64Payload(image.b64_json) ??
    readBase64Payload(image.base64) ??
    dataUrl;

  return {
    url: image.url,
    b64Json: payload?.b64Json,
    dataUrl: image.dataUrl ?? (payload?.mimeType ? toDataUrl(payload.b64Json, payload.mimeType) : undefined),
    mimeType: image.mimeType ?? dataUrl?.mimeType ?? payload?.mimeType,
  };
});

export const imageGenerationResponseSchema = z.object({
  provider: generationProviderSchema,
  model: z.string(),
  images: z.array(generatedImageSchema),
  raw: z.unknown().optional(),
});

/**
 * Video generation request. Only `sora-videos` apiFormat is registered today;
 * the adapter is a placeholder and will throw `ProtocolNotImplementedError`
 * until a real Sora adapter ships.
 */
export const videoGenerationRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  apiFormat: modelApiFormatSchema.optional(),
  /** Seconds. */
  duration: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  seed: z.number().int().optional(),
  n: z.number().int().min(1).max(4).optional(),
  /** Optional end-user identifier forwarded for abuse monitoring. */
  user: z.string().optional(),
  providerOptions: z.record(z.unknown()).optional(),
});

export const generatedVideoSchema = z.object({
  /** Direct URL of the generated video. May be a short-lived signed URL. */
  url: z.string().optional(),
  /** Provider-side video id, when the provider returns a stable handle. */
  id: z.string().optional(),
  mimeType: z.string().optional(),
  durationSeconds: z.number().optional(),
});

export const videoGenerationResponseSchema = z.object({
  provider: generationProviderSchema,
  model: z.string(),
  videos: z.array(generatedVideoSchema),
  raw: z.unknown().optional(),
});

export type ModelApiFormat = z.infer<typeof modelApiFormatSchema>;
export type GenerationProvider = z.infer<typeof generationProviderSchema>;
export type GenerationMessage = z.infer<typeof generationMessageSchema>;
export type TextGenerationRequest = z.infer<typeof textGenerationRequestSchema>;
export type TextGenerationResponse = z.infer<typeof textGenerationResponseSchema>;
export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;
export type ImageGenerationResponse = z.infer<typeof imageGenerationResponseSchema>;
export type VideoGenerationRequest = z.infer<typeof videoGenerationRequestSchema>;
export type VideoGenerationResponse = z.infer<typeof videoGenerationResponseSchema>;
export type GeneratedVideo = z.infer<typeof generatedVideoSchema>;

function parseDataUrl(value: string | undefined): { mimeType: string; b64Json: string } | null {
  const match = value?.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1],
    b64Json: match[2],
  };
}

function readBase64Payload(value: string | undefined): { mimeType?: string; b64Json: string } | null {
  if (!value) return null;
  return parseDataUrl(value) ?? { b64Json: value };
}

function toDataUrl(b64Json: string, mimeType: string): string {
  return `data:${mimeType};base64,${b64Json}`;
}
