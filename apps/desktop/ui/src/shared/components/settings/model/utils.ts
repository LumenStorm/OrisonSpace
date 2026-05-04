import type {
  GenerationProvider,
  ModelCapability,
  ModelProfile,
} from '@orison/shared-contracts';

export type ProfileDraft = {
  id: string | null;
  name: string;
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities: ModelCapability[];
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
  { id: 'openai', labelKey: 'settings.providerOpenai', tokenName: 'accent', defaultBaseUrl: 'https://api.openai.com/v1' },
  { id: 'gcp', labelKey: 'settings.providerGcp', tokenName: 'provider-dot-gcp', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'anthropic', labelKey: 'settings.providerAnthropic', tokenName: 'provider-dot-anthropic', defaultBaseUrl: 'https://api.anthropic.com/v1' },
];

export const CAPABILITY_OPTIONS: ModelCapability[] = ['text', 'image', 'video'];

export const SUPPORTED_PROVIDERS: GenerationProvider[] = PROVIDER_DESCRIPTORS.map((p) => p.id);

export function getProviderDescriptor(provider: GenerationProvider): ProviderDescriptor {
  return PROVIDER_DESCRIPTORS.find((p) => p.id === provider) ?? PROVIDER_DESCRIPTORS[0];
}

export function emptyProfileDraft(): ProfileDraft {
  return {
    id: null,
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    capabilities: ['text'],
  };
}

export function profileToDraft(profile: ModelProfile): ProfileDraft {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    apiKey: profile.apiKey,
    baseUrl: profile.baseUrl,
    model: profile.model,
    capabilities: profile.capabilities,
  };
}

export function draftToProfile(draft: ProfileDraft, fallbackId: string): ModelProfile {
  return {
    id: draft.id ?? fallbackId,
    name: draft.name.trim() || draft.model.trim() || fallbackId,
    provider: draft.provider,
    apiKey: draft.apiKey,
    baseUrl: draft.baseUrl,
    model: draft.model.trim(),
    capabilities: draft.capabilities.length > 0 ? draft.capabilities : ['text'],
  };
}

export function isProfileDirty(draft: ProfileDraft, profile: ModelProfile | undefined): boolean {
  if (!profile) {
    // For a brand-new draft, treat any meaningful field as dirty.
    return Boolean(draft.name || draft.apiKey || draft.model);
  }
  if (draft.name !== profile.name) return true;
  if (draft.provider !== profile.provider) return true;
  if (draft.apiKey !== profile.apiKey) return true;
  if (draft.baseUrl !== profile.baseUrl) return true;
  if (draft.model !== profile.model) return true;
  if (!sameCapabilities(draft.capabilities, profile.capabilities)) return true;
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

export function computeUsedSlots(
  profileId: string,
  selected: Record<UsedSlot, string | null>,
): UsedSlot[] {
  const slots: UsedSlot[] = [];
  if (selected.novel === profileId) slots.push('novel');
  if (selected.image === profileId) slots.push('image');
  if (selected.video === profileId) slots.push('video');
  return slots;
}

export function slotI18nKey(slot: UsedSlot): string {
  if (slot === 'novel') return 'settings.usedForNovel';
  if (slot === 'image') return 'settings.usedForImage';
  return 'settings.usedForVideo';
}
