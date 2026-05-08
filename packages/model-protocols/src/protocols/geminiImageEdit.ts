import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModelProfile,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import { normalizeImageResponse } from '../imageNormalize';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'gemini-image-edit'` — POST
 * {baseUrl}/v1beta/models/{model}:generateContent?key=...
 *
 * Used for Gemini 2.5 / 3.x "Nano Banana" family image models that accept
 * reference images as `inline_data` parts inside the normal text-generation
 * endpoint. Kept distinct from `gemini-images` (Imagen `:predict`) because the
 * wire shapes are incompatible: predict has a flat `instances[].prompt`,
 * generateContent has `contents[].parts[]` with multi-modal items.
 *
 * Mask handling: Gemini has no pixel-level mask concept. Any `request.mask`
 * is silently dropped; the user is expected to describe the intended edit in
 * `prompt` (e.g. "replace the sofa, keep everything else"). The main image is
 * sent as the first `inline_data` part; `referenceImages` follow.
 */
type GeminiEditResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inline_data?: { mime_type?: string; data?: string };
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
};

type InlinePart = { inline_data: { mime_type: string; data: string } };

async function generateImage(
  profile: ResolvedModelProfile,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const url =
    `${baseUrl}/v1beta/models/${encodeURIComponent(profile.modelId)}:generateContent` +
    `?key=${encodeURIComponent(profile.apiKey)}`;

  const parts: Array<{ text: string } | InlinePart> = [{ text: request.prompt }];
  if (request.image) {
    parts.push({
      inline_data: { mime_type: request.image.mimeType, data: request.image.b64Json },
    });
  }
  for (const ref of request.referenceImages ?? []) {
    parts.push({
      inline_data: { mime_type: ref.mimeType, data: ref.b64Json },
    });
  }

  const opts = request.providerOptions?.['gemini-image-edit'] ?? {};
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE'],
  };
  // Allow providerOptions to override / extend (e.g. imageConfig, thinkingConfig)
  Object.assign(generationConfig, opts);

  const raw = await postJson<GeminiEditResponse>({
    url,
    body: {
      contents: [{ role: 'user', parts }],
      generationConfig,
    },
    signal: ctx?.signal,
  });

  const images: ImageGenerationResponse['images'] = [];
  for (const candidate of raw.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inline_data ?? part.inlineData;
      if (!inline?.data) continue;
      const mimeType =
        (part.inline_data?.mime_type ?? part.inlineData?.mimeType ?? 'image/png');
      images.push({ url: undefined, b64Json: inline.data, mimeType, dataUrl: undefined });
    }
  }

  return normalizeImageResponse({
    provider: 'gcp',
    model: profile.modelId,
    images,
    raw,
  });
}

export const geminiImageEditProtocol: ProtocolAdapter = {
  apiFormat: 'gemini-image-edit',
  generateImage,
};
