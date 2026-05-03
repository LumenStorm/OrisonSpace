import type { ProviderAdapter } from '../types';
import { generateAnthropicImage } from './image';
import { generateAnthropicText } from './text';

export const anthropicProvider: ProviderAdapter = {
  provider: 'anthropic',
  generateText: generateAnthropicText,
  generateImage: generateAnthropicImage,
};
