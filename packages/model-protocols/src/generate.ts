import type {
  GenerationFinishReason,
  GenerationUsage,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModel,
  TextGenerationRequest,
  TextGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from '@orison/shared-contracts';
import { base64ToBlob, normalizeBaseUrl, postJson, postMultipart } from './http';
import { normalizeImageResponse } from './imageNormalize';
import { ProtocolHttpError, ProtocolNotImplementedError } from './errors';
import type { ProtocolCallContext } from './types';

// ── Text generation (POST /chat/completions) ──

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function mapFinishReason(raw: string | undefined): GenerationFinishReason | undefined {
  switch (raw) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'content_filter': return 'content_filter';
    case 'tool_calls': return 'tool_use';
    case undefined: return undefined;
    default: return 'other';
  }
}

function mapUsage(raw: OpenAiChatResponse['usage']): GenerationUsage | undefined {
  if (!raw) return undefined;
  return { promptTokens: raw.prompt_tokens, completionTokens: raw.completion_tokens, totalTokens: raw.total_tokens };
}

export async function generateText(
  model: ResolvedModel,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = normalizeBaseUrl(model.baseUrl);
  const raw = await postJson<OpenAiChatResponse>({
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${model.apiKey}` },
    body: {
      model: model.modelId,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    },
    signal: ctx?.signal,
  });
  return {
    model: model.modelId,
    text: raw.choices?.[0]?.message?.content ?? '',
    usage: mapUsage(raw.usage),
    finishReason: mapFinishReason(raw.choices?.[0]?.finish_reason),
  };
}

// ── Image generation (POST /images/generations or /images/edits) ──

type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

export async function generateImage(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (request.image) {
    return editImage(model, request, ctx);
  }
  return generateFromPrompt(model, request, ctx);
}

async function generateFromPrompt(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  const baseUrl = normalizeBaseUrl(model.baseUrl);
  const body: Record<string, unknown> = {
    model: model.modelId,
    prompt: request.prompt,
    n: request.n ?? 1,
    response_format: 'b64_json',
  };
  if (request.size) body.size = request.size;
  if (request.quality) body.quality = request.quality;
  if (request.background) body.background = request.background;
  if (request.outputFormat) body.output_format = request.outputFormat;

  const raw = await postJson<OpenAiImageResponse>({
    url: `${baseUrl}/images/generations`,
    headers: { authorization: `Bearer ${model.apiKey}` },
    body,
    signal: ctx?.signal,
  });
  return buildImageResponse(model, raw);
}

async function editImage(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (!request.image || !('b64Json' in request.image)) throw new ProtocolHttpError('editImage requires base64 image input', 500);
  const baseUrl = normalizeBaseUrl(model.baseUrl);

  const form = new FormData();
  form.set('model', model.modelId);
  form.set('prompt', request.prompt);
  form.set('image', base64ToBlob(request.image.b64Json, request.image.mimeType), 'image.png');
  if (request.mask && 'b64Json' in request.mask) {
    form.set('mask', base64ToBlob(request.mask.b64Json, request.mask.mimeType), 'mask.png');
  }
  if (request.n !== undefined) form.set('n', String(request.n));
  if (request.size) form.set('size', request.size);

  const raw = await postMultipart<OpenAiImageResponse>({
    url: `${baseUrl}/images/edits`,
    headers: { authorization: `Bearer ${model.apiKey}` },
    formData: form,
    signal: ctx?.signal,
  });
  return buildImageResponse(model, raw);
}

async function buildImageResponse(model: ResolvedModel, raw: OpenAiImageResponse): Promise<ImageGenerationResponse> {
  const response: ImageGenerationResponse = {
    model: model.modelId,
    images: (raw.data ?? []).map((img) => ({
      url: img.url,
      b64Json: img.b64_json ?? img.b64Json ?? img.base64,
    })),
  };
  return normalizeImageResponse(response);
}

// ── Video generation (placeholder — no standard OpenAI video endpoint yet) ──

export async function generateVideo(
  _model: ResolvedModel,
  _request: VideoGenerationRequest,
  _ctx?: ProtocolCallContext,
): Promise<VideoGenerationResponse> {
  throw new ProtocolNotImplementedError(
    'Video generation is not yet implemented. Waiting for a standard OpenAI-compatible video endpoint.',
  );
}
