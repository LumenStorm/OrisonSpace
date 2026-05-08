import type { ModelCapability, ModelRegistry, ModelRegistryEntry } from './contracts/model';

// Inline the registry data at build time — avoids runtime YAML parsing in the renderer.
const REGISTRY_ENTRIES: ModelRegistryEntry[] = [
  // Image models
  { pattern: 'dall-e-*', capability: 'image', alias: 'DALL·E' },
  { pattern: 'gpt-image-*', capability: 'image', alias: 'GPT Image' },
  { pattern: 'stable-diffusion-*', capability: 'image', alias: 'Stable Diffusion' },
  { pattern: 'sd-*', capability: 'image', alias: 'SD' },
  { pattern: 'sdxl-*', capability: 'image', alias: 'SDXL' },
  { pattern: 'flux-*', capability: 'image', alias: 'Flux' },
  { pattern: 'midjourney*', capability: 'image', alias: 'Midjourney' },
  { pattern: 'playground-*', capability: 'image', alias: 'Playground' },
  { pattern: 'imagen-*', capability: 'image', alias: 'Imagen' },
  // Video models
  { pattern: 'sora*', capability: 'video', alias: 'Sora' },
  { pattern: 'veo*', capability: 'video', alias: 'Veo' },
  { pattern: 'cogvideox*', capability: 'video', alias: 'CogVideoX' },
  { pattern: 'kling*', capability: 'video', alias: 'Kling' },
  { pattern: 'runway*', capability: 'video', alias: 'Runway' },
  { pattern: 'pika*', capability: 'video', alias: 'Pika' },
  { pattern: 'luma*', capability: 'video', alias: 'Luma' },
  { pattern: 'minimax-video*', capability: 'video', alias: 'MiniMax Video' },
  { pattern: 'wan-*', capability: 'video', alias: 'Wan' },
  // Text models
  { pattern: 'gpt-4o*', capability: 'text', alias: 'GPT-4o' },
  { pattern: 'gpt-4.1*', capability: 'text', alias: 'GPT-4.1' },
  { pattern: 'gpt-4*', capability: 'text', alias: 'GPT-4' },
  { pattern: 'gpt-3.5*', capability: 'text', alias: 'GPT-3.5' },
  { pattern: 'o1*', capability: 'text', alias: 'o1' },
  { pattern: 'o3*', capability: 'text', alias: 'o3' },
  { pattern: 'o4*', capability: 'text', alias: 'o4' },
  { pattern: 'claude-*', capability: 'text', alias: 'Claude' },
  { pattern: 'gemini-*', capability: 'text', alias: 'Gemini' },
  { pattern: 'deepseek-*', capability: 'text', alias: 'DeepSeek' },
  { pattern: 'qwen-*', capability: 'text', alias: 'Qwen' },
  { pattern: 'glm-*', capability: 'text', alias: 'GLM' },
  { pattern: 'yi-*', capability: 'text', alias: 'Yi' },
  { pattern: 'mistral-*', capability: 'text', alias: 'Mistral' },
  { pattern: 'llama-*', capability: 'text', alias: 'Llama' },
  { pattern: 'command-*', capability: 'text', alias: 'Command' },
];

function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

export function resolveModelInfo(modelId: string): { capability: ModelCapability; alias: string } {
  for (const entry of REGISTRY_ENTRIES) {
    if (globMatch(entry.pattern, modelId)) {
      return { capability: entry.capability, alias: entry.alias };
    }
  }
  return { capability: 'text', alias: modelId };
}

export function getModelRegistry(): ModelRegistry {
  return { entries: REGISTRY_ENTRIES };
}
