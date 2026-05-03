import type { ImageGenerationRequest, ImageGenerationResponse } from '@orison/shared-contracts';
import { GenerationProviderError } from '../types';

export async function generateAnthropicImage(_request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  throw new GenerationProviderError('Anthropic image generation is not supported by this provider adapter', 400);
}
