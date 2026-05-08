import { ipcMain } from 'electron';
import type {
  GenerateImagePayload,
  GenerateTextPayload,
  GenerateVideoPayload,
  ImageGenerationResponse,
  ModelRef,
  ResolvedModel,
  TextGenerationResponse,
  VideoGenerationResponse,
} from '@orison/shared-contracts';
import { generateText, generateImage, generateVideo } from '@orison/model-protocols';
import { readModelConfigFromDisk } from './configIpc';

/**
 * Resolve a `{keyId, modelId}` ref to a `ResolvedModel` with decrypted apiKey.
 */
export function resolveModel(ref: ModelRef): ResolvedModel {
  const config = readModelConfigFromDisk();
  const key = config.keys.find((k) => k.id === ref.keyId);
  if (!key) {
    throw new Error(`Model ref points to unknown key '${ref.keyId}'`);
  }
  const model = key.models.find((m) => m.id === ref.modelId);
  if (!model) {
    throw new Error(`Model '${ref.modelId}' not found in key '${key.name}'`);
  }
  return {
    keyId: key.id,
    modelId: model.id,
    baseUrl: key.baseUrl,
    apiKey: key.apiKey,
    capability: model.capability,
  };
}

export function registerModelGatewayIpc() {
  ipcMain.handle('model:generate-text', async (_event, payload: GenerateTextPayload) => {
    return handleGenerateText(payload);
  });
  ipcMain.handle('model:generate-image', async (_event, payload: GenerateImagePayload) => {
    return handleGenerateImage(payload);
  });
  ipcMain.handle('model:generate-video', async (_event, payload: GenerateVideoPayload) => {
    return handleGenerateVideo(payload);
  });
}

export async function handleGenerateText(payload: GenerateTextPayload): Promise<TextGenerationResponse> {
  const resolved = resolveModel(payload.ref);
  return generateText(resolved, payload.request);
}

export async function handleGenerateImage(payload: GenerateImagePayload): Promise<ImageGenerationResponse> {
  const resolved = resolveModel(payload.ref);
  return generateImage(resolved, payload.request);
}

export async function handleGenerateVideo(payload: GenerateVideoPayload): Promise<VideoGenerationResponse> {
  const resolved = resolveModel(payload.ref);
  return generateVideo(resolved, payload.request);
}
