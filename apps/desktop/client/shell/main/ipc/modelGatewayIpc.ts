import { ipcMain } from 'electron';
import type {
  GenerateImagePayload,
  GenerateTextPayload,
  ImageGenerationResponse,
  ModelRef,
  ResolvedModel,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import {
  generateTextPayloadSchema,
  generateImagePayloadSchema,
} from '@orison/shared-contracts';
import { generateText, generateImage } from '@orison/model-protocols';
import { readModelConfigFromDisk } from './configIpc';

/**
 * Resolve a `{keyId, modelId}` ref to a `ResolvedModel` with decrypted apiKey.
 * When keyId is 'default', uses the first available key with an enabled model.
 */
export function resolveModel(ref: ModelRef): ResolvedModel {
  const config = readModelConfigFromDisk();

  let key = config.keys.find((k) => k.id === ref.keyId);
  let modelId = ref.modelId;

  // `default` / empty ref is the only path allowed to auto-pick: use the first
  // key that still has an enabled model. An explicit keyId must resolve as-is.
  const isDefaultRef = ref.keyId === 'default' || !ref.keyId;
  if (!key && isDefaultRef) {
    for (const k of config.keys) {
      const enabled = k.models.find((m) => m.enabled !== false);
      if (enabled) {
        key = k;
        if (modelId === 'default' || !modelId) modelId = enabled.id;
        break;
      }
    }
  }

  if (!key) {
    throw new Error(`Model ref points to unknown key '${ref.keyId}'`);
  }

  // Auto-pick mode (default ref): fall back to any enabled model in the key.
  // Explicit mode: the named model must exist AND be enabled — never silently
  // substitute or call a disabled model. Disabling a model in settings must
  // actually stop calls that reference it.
  let model = key.models.find((m) => m.id === modelId);
  if (!model && isDefaultRef) {
    model = key.models.find((m) => m.enabled !== false);
  }
  if (!model) {
    throw new Error(`Model '${modelId}' not found in key '${key.name}'`);
  }
  if (model.enabled === false) {
    throw new Error(
      `Model '${model.alias || model.id}' is disabled in key '${key.name}'. Select an enabled model.`,
    );
  }
  return {
    keyId: key.id,
    modelId: model.id,
    protocol: key.protocol,
    baseUrl: key.baseUrl,
    apiKey: key.apiKey,
    capability: model.capability,
  };
}

export function registerModelGatewayIpc() {
  // Validate renderer-supplied payloads at the IPC boundary. The shared
  // handleGenerate* fns below are also called by the agent with a trusted
  // shape, so validation lives here rather than in the handlers.
  ipcMain.handle('model:generate-text', async (_event, payload: GenerateTextPayload) => {
    return handleGenerateText(generateTextPayloadSchema.parse(payload));
  });
  ipcMain.handle('model:generate-image', async (_event, payload: GenerateImagePayload) => {
    return handleGenerateImage(generateImagePayloadSchema.parse(payload));
  });
}

export async function handleGenerateText(payload: GenerateTextPayload, signal?: AbortSignal): Promise<TextGenerationResponse> {
  const resolved = resolveModel(payload.ref);
  return generateText(resolved, payload.request, { signal });
}

export async function handleGenerateImage(payload: GenerateImagePayload, signal?: AbortSignal): Promise<ImageGenerationResponse> {
  const resolved = resolveModel(payload.ref);
  return generateImage(resolved, payload.request, { signal });
}
