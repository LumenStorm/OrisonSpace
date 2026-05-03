import type { ProviderAdapter } from '../types';
import { generateOpenAiImage } from './image';
import { generateOpenAiText } from './text';

export const openAiProvider: ProviderAdapter = {
  provider: 'openai',
  generateText: generateOpenAiText,
  generateImage: generateOpenAiImage,
};
