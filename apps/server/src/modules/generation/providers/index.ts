import type { GenerationProvider } from '@orison/shared-contracts';
import { anthropicProvider } from './anthropic';
import { gcpProvider } from './gcp';
import { openAiProvider } from './openai';
import type { ProviderAdapter } from './types';

const providers: Record<GenerationProvider, ProviderAdapter> = {
  openai: openAiProvider,
  gcp: gcpProvider,
  anthropic: anthropicProvider,
};

export function getProvider(provider: GenerationProvider): ProviderAdapter {
  return providers[provider];
}

export { GenerationProviderError } from './types';
