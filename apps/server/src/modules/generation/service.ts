import type {
  GenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import { normalizeImageResponseToBase64 } from './imageBase64';
import { getProvider } from './providers';

export async function generateText(
  provider: GenerationProvider,
  request: TextGenerationRequest,
): Promise<TextGenerationResponse> {
  return getProvider(provider).generateText(request);
}

export async function generateImage(
  provider: GenerationProvider,
  request: ImageGenerationRequest,
): Promise<ImageGenerationResponse> {
  const response = await getProvider(provider).generateImage(request);
  return normalizeImageResponseToBase64(response);
}
