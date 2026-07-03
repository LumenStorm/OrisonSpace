import { z } from 'zod';

export const generationMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('system'), content: z.string() }),
  z.object({ role: z.literal('user'), content: z.string() }),
  z.object({
    role: z.literal('assistant'),
    content: z.string(),
    toolCalls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string(),
    })).optional(),
  }),
  z.object({
    role: z.literal('tool'),
    toolCallId: z.string(),
    content: z.string(),
  }),
]);

/**
 * Normalized usage counters across providers.
 */
export const generationUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).partial();

export const generationFinishReasonSchema = z.enum([
  'stop', 'length', 'content_filter', 'tool_use', 'other',
]);

export const imageInputSchema = z.object({
  b64Json: z.string().min(1),
  mimeType: z.string().min(1),
});

export const toolFunctionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.unknown(),
  }),
});

export const toolCallResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

export const textGenerationRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(generationMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(toolFunctionSchema).optional(),
});

export const textGenerationResponseSchema = z.object({
  model: z.string(),
  text: z.string(),
  finishReason: generationFinishReasonSchema.optional(),
  usage: generationUsageSchema.optional(),
  toolCalls: z.array(toolCallResultSchema).optional(),
});

export const imageGenerationRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
  quality: z.string().optional(),
  image: imageInputSchema.optional(),
  mask: imageInputSchema.optional(),
  background: z.string().optional(),
  outputFormat: z.string().optional(),
});

export const imageGenerationResponseSchema = z.object({
  model: z.string(),
  images: z.array(z.object({
    b64Json: z.string().optional(),
    url: z.string().optional(),
    mimeType: z.string().optional(),
    dataUrl: z.string().optional(),
    revisedPrompt: z.string().optional(),
  })),
});

/** {keyId, modelId} pointer to a configured key + model. */
export const modelRefSchema = z.object({
  keyId: z.string().min(1),
  modelId: z.string().min(1),
});

export const generateTextPayloadSchema = z.object({
  ref: modelRefSchema,
  request: textGenerationRequestSchema,
});

export const generateImagePayloadSchema = z.object({
  ref: modelRefSchema,
  request: imageGenerationRequestSchema,
});

export type GenerationMessage = z.infer<typeof generationMessageSchema>;
export type GenerationUsage = z.infer<typeof generationUsageSchema>;
export type GenerationFinishReason = z.infer<typeof generationFinishReasonSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
export type TextGenerationRequest = z.infer<typeof textGenerationRequestSchema>;
export type TextGenerationResponse = z.infer<typeof textGenerationResponseSchema>;
export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;
export type ImageGenerationResponse = z.infer<typeof imageGenerationResponseSchema>;
export type ToolFunction = z.infer<typeof toolFunctionSchema>;
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;
