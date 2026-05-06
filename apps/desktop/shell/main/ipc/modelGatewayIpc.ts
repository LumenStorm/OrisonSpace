import { ipcMain } from 'electron';
import type {
  GenerateImagePayload,
  GenerateTextPayload,
  GenerateVideoPayload,
  ImageGenerationResponse,
  ModelProfile,
  ResolvedModelProfile,
  SlotAssignment,
  TextGenerationResponse,
  VideoGenerationResponse,
} from '@orison/shared-contracts';
import { ProtocolCapabilityError, assertCapability, getProtocol } from '@orison/model-protocols';
import { readModelConfigFromDisk } from './configIpc';

/**
 * Resolve a `{profileId, modelId}` slot to a `ResolvedModelProfile` with
 * decrypted apiKey ready for `@orison/model-protocols` adapters.
 *
 * Throws when the slot points to a profile that no longer exists, or the
 * model id is missing from the profile. Never returns a partial profile.
 */
export function resolveSlot(slot: SlotAssignment): ResolvedModelProfile {
  const config = readModelConfigFromDisk();
  const profile = config.profiles.find((p) => p.id === slot.profileId);
  if (!profile) {
    throw new Error(`Model slot points to unknown profile '${slot.profileId}'`);
  }
  const entry = profile.models.find((m) => m.id === slot.modelId);
  if (!entry) {
    throw new Error(
      `Model slot ${slot.profileId}/${slot.modelId} no longer exists in profile`,
    );
  }
  return buildResolvedProfile(profile, entry.apiFormat, entry.id, entry.capabilities);
}

function buildResolvedProfile(
  profile: ModelProfile,
  apiFormat: ResolvedModelProfile['apiFormat'],
  modelId: string,
  capabilities: ResolvedModelProfile['capabilities'],
): ResolvedModelProfile {
  return {
    profileId: profile.id,
    modelId,
    apiFormat,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    capabilities,
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
  const profile = resolveSlot(payload.slot);
  if (!profile.capabilities.includes('text')) {
    throw new ProtocolCapabilityError(
      `Model ${profile.modelId} (${profile.apiFormat}) is not assigned the 'text' capability`,
    );
  }
  assertCapability(profile.apiFormat, 'generateText');
  const adapter = getProtocol(profile.apiFormat);
  const response = await adapter.generateText!(profile, payload.request);
  return stripSecrets(response);
}

export async function handleGenerateImage(payload: GenerateImagePayload): Promise<ImageGenerationResponse> {
  const profile = resolveSlot(payload.slot);
  if (!profile.capabilities.includes('image')) {
    throw new ProtocolCapabilityError(
      `Model ${profile.modelId} (${profile.apiFormat}) is not assigned the 'image' capability`,
    );
  }
  assertCapability(profile.apiFormat, 'generateImage');
  const adapter = getProtocol(profile.apiFormat);
  const response = await adapter.generateImage!(profile, payload.request);
  return stripSecrets(response);
}

export async function handleGenerateVideo(payload: GenerateVideoPayload): Promise<VideoGenerationResponse> {
  const profile = resolveSlot(payload.slot);
  if (!profile.capabilities.includes('video')) {
    throw new ProtocolCapabilityError(
      `Model ${profile.modelId} (${profile.apiFormat}) is not assigned the 'video' capability`,
    );
  }
  assertCapability(profile.apiFormat, 'generateVideo');
  const adapter = getProtocol(profile.apiFormat);
  const response = await adapter.generateVideo!(profile, payload.request);
  return stripSecrets(response);
}

/**
 * Drop any `apiKey` / `Authorization` bleed-through from adapter responses.
 *
 * Adapters do return `raw` echo of the upstream JSON for debugging, so this
 * is a defence-in-depth rather than the primary boundary (the primary
 * boundary is that we never put apiKey into the request body).
 */
function stripSecrets<T>(response: T): T {
  if (response && typeof response === 'object' && 'raw' in response) {
    const cloned = { ...(response as Record<string, unknown>) };
    delete cloned.raw;
    return cloned as T;
  }
  return response;
}
