import type {
  GenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
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
  return getProvider(provider).generateImage(request);
}
