import type { ProviderAdapter } from '../types';
import { generateGcpImage } from './image';
import { generateGcpText } from './text';

export const gcpProvider: ProviderAdapter = {
  provider: 'gcp',
  generateText: generateGcpText,
  generateImage: generateGcpImage,
};
