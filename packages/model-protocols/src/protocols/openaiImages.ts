import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModelProfile,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import { ProtocolHttpError } from '../errors';
import { normalizeImageResponse } from '../imageNormalize';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'openai-images'` — POST {baseUrl}/images/generations.
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

  Object.assign(body, request.providerOptions ?? {});

  const raw = await postJson<OpenAiImageResponse>({
    url: `${baseUrl}/images/generations`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body,
    signal: ctx?.signal,
  });

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
