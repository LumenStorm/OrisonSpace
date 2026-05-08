import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModelProfile,
} from '@orison/shared-contracts';
import { base64ToBlob, postJson, postMultipart, trimTrailingSlash } from '../http';
import { ProtocolHttpError } from '../errors';
import { normalizeImageResponse } from '../imageNormalize';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'openai-images'` — generation and editing.
 *
 * - No `request.image` → POST {baseUrl}/images/generations (JSON)
 * - `request.image` present → POST {baseUrl}/images/edits (multipart)
 *
 * Family detection (gpt-image-2 / gpt-image-1 / fallback dall-e-style) is
 * preserved verbatim from the previous server-side adapter so existing
 * profiles keep working.
 */
type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

function detectImageFamily(model: string): 'gpt-image-2' | 'gpt-image-1' | 'fallback' {
  const m = model.toLowerCase().trim();
  if (m.startsWith('gpt-image-2')) return 'gpt-image-2';
  if (m.startsWith('gpt-image-1')) return 'gpt-image-1';
  return 'fallback';
}

async function generateImage(
  profile: ResolvedModelProfile,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (request.image) {
    return editImage(profile, request, ctx);
  }
  return generateFromPrompt(profile, request, ctx);
}

async function generateFromPrompt(
  profile: ResolvedModelProfile,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const family = detectImageFamily(profile.modelId);

  if (family === 'gpt-image-2' && request.background === 'transparent') {
    throw new ProtocolHttpError(
      'gpt-image-2 does not support transparent backgrounds. Use gpt-image-1 if you need transparency.',
      400,
    );
  }

  const body: Record<string, unknown> = {
    model: profile.modelId,
    prompt: request.prompt,
    n: request.n ?? 1,
  };
  if (request.size) body.size = request.size;
  if (request.quality) body.quality = request.quality;
  if (request.user) body.user = request.user;

  if (family === 'gpt-image-2' || family === 'gpt-image-1') {
    if (request.background) body.background = request.background;
    if (request.outputFormat) body.output_format = request.outputFormat;
    if (request.outputCompression !== undefined) body.output_compression = request.outputCompression;
    if (request.moderation) body.moderation = request.moderation;
  } else {
    body.response_format = 'b64_json';
  }

  Object.assign(body, request.providerOptions?.['openai-images'] ?? {});

  const raw = await postJson<OpenAiImageResponse>({
    url: `${baseUrl}/images/generations`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body,
    signal: ctx?.signal,
  });

  return buildResponse(profile, raw);
}

/**
 * OpenAI /v1/images/edits — multipart/form-data.
 *
 * Required: image + prompt. Optional: mask (PNG with alpha=0 marking the area
 * to edit; must be same dimensions as image), n, size, response_format,
 * user. gpt-image-1 accepts additional fields (quality, background,
 * output_format, output_compression, moderation) — those are forwarded when
 * the family detects gpt-image-1 or via providerOptions.
 *
 * NewAPI's docs only list the DALL-E-2 subset, but the endpoint accepts the
 * full OpenAI set; providerOptions['openai-images'] is the escape hatch for
 * any field we don't hard-code here.
 */
async function editImage(
  profile: ResolvedModelProfile,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (!request.image) {
    throw new ProtocolHttpError('editImage called without request.image', 500);
  }
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const family = detectImageFamily(profile.modelId);

  const form = new FormData();
  form.set('model', profile.modelId);
  form.set('prompt', request.prompt);
  form.set(
    'image',
    base64ToBlob(request.image.b64Json, request.image.mimeType),
    'image.png',
  );
  if (request.mask) {
    form.set(
      'mask',
      base64ToBlob(request.mask.b64Json, request.mask.mimeType),
      'mask.png',
    );
  }
  if (request.n !== undefined) form.set('n', String(request.n));
  if (request.size) form.set('size', request.size);
  if (request.user) form.set('user', request.user);

  if (family === 'gpt-image-2' || family === 'gpt-image-1') {
    if (request.quality) form.set('quality', request.quality);
    if (request.background) form.set('background', request.background);
    if (request.outputFormat) form.set('output_format', request.outputFormat);
    if (request.outputCompression !== undefined) {
      form.set('output_compression', String(request.outputCompression));
    }
    if (request.moderation) form.set('moderation', request.moderation);
  } else {
    // DALL-E-2 style needs response_format to get base64 back
    form.set('response_format', 'b64_json');
  }

  // Escape hatch for any field we don't hard-code (gpt-image-1 extras, etc.)
  const extra = request.providerOptions?.['openai-images'] ?? {};
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null) continue;
    form.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  const raw = await postMultipart<OpenAiImageResponse>({
    url: `${baseUrl}/images/edits`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    formData: form,
    signal: ctx?.signal,
  });

  return buildResponse(profile, raw);
}

async function buildResponse(
  profile: ResolvedModelProfile,
  raw: OpenAiImageResponse,
): Promise<ImageGenerationResponse> {
  const response: ImageGenerationResponse = {
    provider: 'openai',
    model: profile.modelId,
    images: (raw.data ?? []).map((image) => ({
      url: image.url,
      b64Json: image.b64_json ?? image.b64Json ?? image.base64,
      mimeType: undefined,
      dataUrl: undefined,
    })),
    raw,
  };

  return normalizeImageResponse(response);
}

export const openaiImagesProtocol: ProtocolAdapter = {
  apiFormat: 'openai-images',
  generateImage,
};
