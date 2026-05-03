import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type GcpImageResponse = {
  predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
};

export async function generateGcpImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta');
  const raw = await postJson<GcpImageResponse>({
    url: `${baseUrl}/models/${encodeURIComponent(request.model)}:predict?key=${encodeURIComponent(request.apiKey ?? '')}`,
    body: {
      instances: [{ prompt: request.prompt }],
      parameters: {
        sampleCount: request.n ?? 1,
        size: request.size,
      },
    },
  });

  return {
    provider: 'gcp',
    model: request.model,
    images: (raw.predictions ?? []).map((prediction) => ({
      b64Json: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType,
    })),
    raw,
  };
}
