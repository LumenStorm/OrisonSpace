import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

export async function generateOpenAiImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
  const raw = await postJson<OpenAiImageResponse>({
    url: `${baseUrl}/images/generations`,
    headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
    body: {
      model: request.model,
      prompt: request.prompt,
      size: request.size,
      n: request.n ?? 1,
      response_format: 'b64_json',
    },
  });

  return {
    provider: 'openai',
    model: request.model,
    images: (raw.data ?? []).map((image) => ({
      url: image.url,
      b64Json: image.b64_json ?? image.b64Json ?? image.base64,
    })),
    raw,
  };
}
