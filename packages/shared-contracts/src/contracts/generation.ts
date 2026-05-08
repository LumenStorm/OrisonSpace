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
  'gemini-image-edit',
  'sora-videos',
]);

export const generationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

/**
 * Per-apiFormat provider options. Adapters read only their own namespace, so a
 * single request object can safely carry options for multiple apiFormats
 * without cross-contamination when the UI swaps models between formats.
 */
export const providerOptionsSchema = z.object({
  'openai-chat-completions': z.record(z.unknown()).optional(),
  'openai-responses': z.record(z.unknown()).optional(),
  'claude-messages': z.record(z.unknown()).optional(),
  'gemini-generate-content': z.record(z.unknown()).optional(),
  'openai-images': z.record(z.unknown()).optional(),
  'gemini-images': z.record(z.unknown()).optional(),
  'gemini-image-edit': z.record(z.unknown()).optional(),
  'sora-videos': z.record(z.unknown()).optional(),
}).partial();

/**
 * Normalized usage counters across providers.
 * - OpenAI Chat: `usage.prompt_tokens` / `completion_tokens` / `total_tokens`
 * - OpenAI Responses: `usage.input_tokens` / `output_tokens` / `total_tokens`
 * - Claude: `usage.input_tokens` / `output_tokens` (totalTokens computed)
 * - Gemini: `usageMetadata.promptTokenCount` / `candidatesTokenCount` / `totalTokenCount`
 */
export const generationUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).partial();

/**
 * Normalized stop reason across providers. Mapping per adapter:
 * - OpenAI Chat `finish_reason`: stop→stop, length→length, content_filter→content_filter, tool_calls→tool_use
 * - OpenAI Responses `status`: completed→stop, incomplete+max_output_tokens→length
 * - Claude `stop_reason`: end_turn/stop_sequence→stop, max_tokens→length, tool_use→tool_use
 * - Gemini `finishReason`: STOP→stop, MAX_TOKENS→length, SAFETY/RECITATION→content_filter
 */
export const generationFinishReasonSchema = z.enum([
  'stop', 'length', 'content_filter', 'tool_use', 'other',
]);

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
   * Per-apiFormat passthrough for protocol-specific options. Adapters read
   * only their own namespace (e.g. Claude `thinking`, OpenAI `tools`), so
   * this object can safely carry options for several formats at once.
   */
  providerOptions: providerOptionsSchema.optional(),
});

export const textGenerationResponseSchema = z.object({
  provider: generationProviderSchema,
  model: z.string(),
  text: z.string(),
  id: z.string().optional(),
  created: z.number().int().nonnegative().optional(),
  usage: generationUsageSchema.optional(),
  finishReason: generationFinishReasonSchema.optional(),
  raw: z.unknown().optional(),
});

/**
 * Base64-encoded image payload used for image editing (main image, mask,
 * or additional reference images). `b64Json` must be the raw base64 string
 * without any `data:...;base64,` prefix — the UI strips that in
 * `dataUrlToBase64` before calling the gateway.
 */
export const imageInputSchema = z.object({
  b64Json: z.string().min(1),
  mimeType: z.string().regex(/^image\//),
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
  /**
   * Main image to edit. Triggers OpenAI `/images/edits` multipart branch or
   * Gemini `generateContent` inpaint-style prompt.
   */
  image: imageInputSchema.optional(),
  /**
   * Pixel mask for OpenAI `/images/edits` — alpha=0 regions mark the area to
   * edit. Silently ignored by Gemini adapters, which have no explicit mask
   * concept.
   */
  mask: imageInputSchema.optional(),
  /**
   * Additional reference images (character consistency, style transfer).
   * Gemini 3.1 Flash Image accepts up to 14, 2.5 Flash Image up to 3.
   * OpenAI adapters currently ignore this field.
   */
  referenceImages: z.array(imageInputSchema).max(14).optional(),
  /** Per-apiFormat passthrough. See textGenerationRequestSchema. */
  providerOptions: providerOptionsSchema.optional(),
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
  providerOptions: providerOptionsSchema.optional(),
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
export type ProviderOptions = z.infer<typeof providerOptionsSchema>;
export type GenerationUsage = z.infer<typeof generationUsageSchema>;
export type GenerationFinishReason = z.infer<typeof generationFinishReasonSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
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
