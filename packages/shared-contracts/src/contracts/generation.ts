import { z } from 'zod';

export const generationProviderSchema = z.enum(['openai', 'gcp', 'anthropic']);

export const generationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const textGenerationRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(generationMessageSchema).min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
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
  size: z.string().optional(),
  n: z.number().int().positive().max(8).optional(),
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

export type GenerationProvider = z.infer<typeof generationProviderSchema>;
export type GenerationMessage = z.infer<typeof generationMessageSchema>;
export type TextGenerationRequest = z.infer<typeof textGenerationRequestSchema>;
export type TextGenerationResponse = z.infer<typeof textGenerationResponseSchema>;
export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;
export type ImageGenerationResponse = z.infer<typeof imageGenerationResponseSchema>;

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
