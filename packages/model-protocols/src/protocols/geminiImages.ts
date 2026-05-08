import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModelProfile,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import { normalizeImageResponse } from '../imageNormalize';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'gemini-images'` — POST
 * {baseUrl}/v1beta/models/{model}:predict?key=... (Imagen-style),
 * preserving the existing GCP image adapter shape.
 *
 * The newer GenerateContent + responseModalities path is intentionally not
 * implemented here yet; we keep parity with the current server-side behaviour
 * so existing Gemini image profiles continue to work.
 */
type GeminiImageResponse = {
  predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
};

async function generateImage(
  profile: ResolvedModelProfile,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const url =
    `${baseUrl}/v1beta/models/${encodeURIComponent(profile.modelId)}:predict` +
    `?key=${encodeURIComponent(profile.apiKey)}`;
  const opts = request.providerOptions?.['gemini-images'] ?? {};
  const raw = await postJson<GeminiImageResponse>({
    url,
    body: {
      instances: [{ prompt: request.prompt }],
      parameters: {
        sampleCount: request.n ?? 1,
        size: request.size,
        ...opts,
      },
    },
    signal: ctx?.signal,
  });

  const response: ImageGenerationResponse = {
    provider: 'gcp',
    model: profile.modelId,
    images: (raw.predictions ?? []).map((p) => ({
      url: undefined,
      b64Json: p.bytesBase64Encoded,
      mimeType: p.mimeType,
      dataUrl: undefined,
    })),
    raw,
  };

  return normalizeImageResponse(response);
}

export const geminiImagesProtocol: ProtocolAdapter = {
  apiFormat: 'gemini-images',
  generateImage,
};
