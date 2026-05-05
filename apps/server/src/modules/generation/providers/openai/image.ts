import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import { GenerationProviderError } from '../types';

type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

/**
 * Detect the OpenAI image-model family. Order matters: gpt-image-2 must be
 * checked before gpt-image-1 so a hypothetical `gpt-image-2.5` doesn't fall
 * back to the gpt-image-1 row.
 *
 * Both gpt-image-* families always return base64 and reject `response_format`.
 * The `fallback` family covers dall-e-* and third-party OpenAI-compatible
 * endpoints, where `response_format: b64_json` is still required to avoid a
 * second download hop on the renderer side.
 */
function detectImageFamily(model: string): 'gpt-image-2' | 'gpt-image-1' | 'fallback' {
  const m = model.toLowerCase().trim();
  if (m.startsWith('gpt-image-2')) return 'gpt-image-2';
  if (m.startsWith('gpt-image-1')) return 'gpt-image-1';
  return 'fallback';
}

export async function generateOpenAiImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
  const family = detectImageFamily(request.model);

  // Defense-in-depth: gpt-image-2 explicitly rejects `background: 'transparent'`.
  // Fail fast with a friendly 400 instead of letting OpenAI return a less
  // helpful error.
  if (family === 'gpt-image-2' && request.background === 'transparent') {
    throw new GenerationProviderError(
      'gpt-image-2 does not support transparent backgrounds. Use gpt-image-1 if you need transparency.',
      400,
    );
  }

  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    n: request.n ?? 1,
  };
  if (request.size) body.size = request.size;
  if (request.quality) body.quality = request.quality;
  if (request.user) body.user = request.user;

  if (family === 'gpt-image-2' || family === 'gpt-image-1') {
    // Both gpt-image-* families always return base64 in `data[].b64_json` and
    // reject `response_format`. The flags below are gpt-image-* only.
    if (request.background) body.background = request.background;
    if (request.outputFormat) body.output_format = request.outputFormat;
    if (request.outputCompression !== undefined) body.output_compression = request.outputCompression;
    if (request.moderation) body.moderation = request.moderation;
  } else {
    // dall-e-* and unknown OpenAI-compatible providers: ask for base64 so the
    // renderer can persist without a second download hop.
    body.response_format = 'b64_json';
  }

  const raw = await postJson<OpenAiImageResponse>({
    url: `${baseUrl}/images/generations`,
    headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
    body,
  });

  return {
    provider: 'openai',
    model: request.model,
    images: (raw.data ?? []).map((image) => ({
      url: image.url,
      b64Json: image.b64_json ?? image.b64Json ?? image.base64,
      mimeType: undefined,
      dataUrl: undefined,
    })),
    raw,
  };
}
