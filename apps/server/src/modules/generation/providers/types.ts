import type {
  GenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';

export type ProviderAdapter = {
  provider: GenerationProvider;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
};

export class GenerationProviderError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
  }
}
