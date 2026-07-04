import type {
  ApiKeyEntry,
  DiscoveredModel,
  ModelCapability,
  ModelProtocol,
} from '@orison/shared-contracts';

export type KeyDraftModel = {
  id: string;
  alias: string;
  capability: ModelCapability;
  enabled: boolean;
};

export type KeyDraft = {
  id: string | null;
  name: string;
  protocol: ModelProtocol;
  apiKey: string;
  baseUrl: string;
  models: KeyDraftModel[];
};

export function emptyKeyDraft(): KeyDraft {
  return { id: null, name: '', protocol: 'openai-compatible', apiKey: '', baseUrl: '', models: [] };
}

export function keyToDraft(key: ApiKeyEntry): KeyDraft {
  return {
    id: key.id,
    name: key.name,
    protocol: key.protocol,
    apiKey: key.apiKey,
    baseUrl: key.baseUrl,
    models: key.models.map((m) => ({
      id: m.id,
      alias: m.alias,
      capability: m.capability,
      enabled: m.enabled,
    })),
  };
}

export function draftToKey(draft: KeyDraft, fallbackId: string): ApiKeyEntry {
  return {
    id: draft.id ?? fallbackId,
    name: draft.name.trim() || fallbackId,
    protocol: draft.protocol,
    apiKey: draft.apiKey,
    baseUrl: draft.baseUrl.replace(/\/+$/, ''),
    models: draft.models.filter((m) => m.id.trim().length > 0).map<DiscoveredModel>((m) => ({
      id: m.id.trim(),
      alias: m.alias.trim() || m.id.trim(),
      capability: m.capability,
      enabled: m.enabled,
    })),
  };
}

export function isKeyDirty(draft: KeyDraft, key: ApiKeyEntry | undefined): boolean {
  if (!key) {
    return Boolean(draft.name || draft.apiKey || draft.models.length > 0);
  }
  if (draft.name !== key.name) return true;
  if (draft.protocol !== key.protocol) return true;
  if (draft.apiKey !== key.apiKey) return true;
  if (draft.baseUrl !== key.baseUrl) return true;
  if (draft.models.length !== key.models.length) return true;
  for (let i = 0; i < draft.models.length; i++) {
    const d = draft.models[i]!;
    const k = key.models[i];
    if (!k) return true;
    if (d.id !== k.id || d.alias !== k.alias || d.capability !== k.capability || d.enabled !== k.enabled) return true;
  }
  return false;
}

export function nextKeyId(keys: ApiKeyEntry[]): string {
  const existing = new Set(keys.map((k) => k.id));
  let index = 1;
  while (existing.has(`key_${String(index).padStart(3, '0')}`)) index += 1;
  return `key_${String(index).padStart(3, '0')}`;
}

function _formatModelLabel(key: ApiKeyEntry, modelId: string): string {
  const entry = key.models.find((m) => m.id === modelId);
  return `${key.name} · ${entry?.alias ?? modelId}`;
}
