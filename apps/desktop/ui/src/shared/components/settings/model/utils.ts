import { inferApiFormat } from '@orison/model-protocols';
import type {
  GenerationProvider,
  ModelApiFormat,
  ModelCapability,
  ModelEntry,
  ModelProfile,
} from '@orison/shared-contracts';

export type ProfileDraftModel = {
  /** Real model id from the provider's catalog. */
  id: string;
  /** User-editable display alias. */
  alias: string;
  apiFormat: ModelApiFormat;
  capabilities: ModelCapability[];
};

export type ProfileDraft = {
  id: string | null;
  name: string;
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
  models: ProfileDraftModel[];
};

export type UsedSlot = 'novel' | 'image' | 'video';

export type ProviderDescriptor = {
  id: GenerationProvider;
  labelKey: string;
  /** CSS variable name (without `--` prefix) used for the badge dot color. */
  tokenName: string;
  /** Default base URL suggestion when switching to this provider. */
  defaultBaseUrl: string;
};

export const PROVIDER_DESCRIPTORS: ProviderDescriptor[] = [
  { id: 'openai', labelKey: 'settings.providerOpenai', tokenName: 'accent', defaultBaseUrl: 'https://api.openai.com' },
  { id: 'gcp', labelKey: 'settings.providerGcp', tokenName: 'provider-dot-gcp', defaultBaseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'anthropic', labelKey: 'settings.providerAnthropic', tokenName: 'provider-dot-anthropic', defaultBaseUrl: 'https://api.anthropic.com' },
];

export const CAPABILITY_OPTIONS: ModelCapability[] = ['text', 'image', 'video'];

export const SUPPORTED_PROVIDERS: GenerationProvider[] = PROVIDER_DESCRIPTORS.map((p) => p.id);

export const API_FORMAT_OPTIONS: ModelApiFormat[] = [
  'openai-chat-completions',
  'openai-responses',
  'claude-messages',
  'gemini-generate-content',
  'openai-images',
  'gemini-images',
  'sora-videos',
];

export function getProviderDescriptor(provider: GenerationProvider): ProviderDescriptor {
  return PROVIDER_DESCRIPTORS.find((p) => p.id === provider) ?? PROVIDER_DESCRIPTORS[0];
}

export function emptyProfileDraft(): ProfileDraft {
  return {
    id: null,
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: PROVIDER_DESCRIPTORS[0].defaultBaseUrl,
    models: [],
  };
}

export function profileToDraft(profile: ModelProfile): ProfileDraft {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    apiKey: profile.apiKey,
    baseUrl: profile.baseUrl,
    models: profile.models.map((m) => ({
      id: m.id,
      alias: m.alias,
      apiFormat: m.apiFormat,
      capabilities: m.capabilities,
    })),
  };
}

export function draftToProfile(draft: ProfileDraft, fallbackId: string): ModelProfile {
  const id = draft.id ?? fallbackId;
  const trimmed = draft.models
    .filter((m) => m.id.trim().length > 0)
    .map<ModelEntry>((m) => ({
      id: m.id.trim(),
      alias: m.alias.trim() || m.id.trim(),
      apiFormat: m.apiFormat,
      capabilities: m.capabilities.length > 0 ? m.capabilities : ['text'],
    }));

  return {
    schemaVersion: 2,
    id,
    name: draft.name.trim() || fallbackId,
    provider: draft.provider,
    apiKey: draft.apiKey,
    baseUrl: draft.baseUrl,
    models: trimmed.length > 0
      ? trimmed
      : [
        {
          id: 'default',
          alias: draft.name || draft.provider,
          apiFormat: inferApiFormat('default', draft.provider),
          capabilities: ['text'],
        },
      ],
  };
}

export function isProfileDirty(draft: ProfileDraft, profile: ModelProfile | undefined): boolean {
  if (!profile) {
    return Boolean(draft.name || draft.apiKey || draft.models.some((m) => m.id));
  }
  if (draft.name !== profile.name) return true;
  if (draft.provider !== profile.provider) return true;
  if (draft.apiKey !== profile.apiKey) return true;
  if (draft.baseUrl !== profile.baseUrl) return true;
  if (draft.models.length !== profile.models.length) return true;
  for (let i = 0; i < draft.models.length; i += 1) {
    const d = draft.models[i]!;
    const p = profile.models[i];
    if (!p) return true;
    if (d.id !== p.id || d.alias !== p.alias || d.apiFormat !== p.apiFormat) return true;
    if (!sameCapabilities(d.capabilities, p.capabilities)) return true;
  }
  return false;
}

function sameCapabilities(a: ModelCapability[], b: ModelCapability[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const item of b) if (!setA.has(item)) return false;
  return true;
}

export function nextProfileId(profiles: ModelProfile[]): string {
  const existing = new Set(profiles.map((profile) => profile.id));
  let index = 1;
  while (existing.has(`model_${String(index).padStart(3, '0')}`)) index += 1;
  return `model_${String(index).padStart(3, '0')}`;
}

export function toggleCapability(
  capabilities: ModelCapability[],
  capability: ModelCapability,
  enabled: boolean,
): ModelCapability[] {
  const next = new Set(capabilities);
  if (enabled) next.add(capability);
  else next.delete(capability);
  return [...next];
}

/**
 * Compute which slots reference any model in this profile.
 */
export function computeUsedSlots(
  profileId: string,
  selected: { novel: { profileId: string } | null; image: { profileId: string } | null; video: { profileId: string } | null },
): UsedSlot[] {
  const slots: UsedSlot[] = [];
  if (selected.novel?.profileId === profileId) slots.push('novel');
  if (selected.image?.profileId === profileId) slots.push('image');
  if (selected.video?.profileId === profileId) slots.push('video');
  return slots;
}

export function slotI18nKey(slot: UsedSlot): string {
  if (slot === 'novel') return 'settings.usedForNovel';
  if (slot === 'image') return 'settings.usedForImage';
  return 'settings.usedForVideo';
}

/**
 * Build the display label used everywhere a model is referenced in the UI.
 * Returns `{provider} · {alias}` so logs and selectors stay readable when
 * the same `apiFormat` is served by different providers.
 */
export function formatModelLabel(profile: ModelProfile, modelId: string): string {
  const entry = profile.models.find((m) => m.id === modelId);
  return `${profile.provider} · ${entry?.alias ?? modelId}`;
}
