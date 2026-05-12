import type { ApiKeyEntry, ModelRef, NovelModelRuntime } from '@orison/shared-contracts';

export function listNovelTextModelRefs(keys: ApiKeyEntry[]): Array<{ ref: ModelRef; label: string }> {
  const out: Array<{ ref: ModelRef; label: string }> = [];
  for (const key of keys) {
    for (const model of key.models) {
      if (!model.enabled || model.capability !== 'text') continue;
      out.push({
        ref: { keyId: key.id, modelId: model.id },
        label: `${key.name} - ${model.alias}`,
      });
    }
  }
  return out;
}

export function resolveNovelModelRuntime(
  keys: ApiKeyEntry[],
  preferredRef: ModelRef | null,
): NovelModelRuntime | null {
  const options = listNovelTextModelRefs(keys);
  const selected = preferredRef
    ? options.find((opt) => opt.ref.keyId === preferredRef.keyId && opt.ref.modelId === preferredRef.modelId)?.ref
    : options[0]?.ref;
  if (!selected) return null;

  const key = keys.find((entry) => entry.id === selected.keyId);
  const model = key?.models.find((entry) => entry.id === selected.modelId);
  if (!key || !model || !model.enabled || model.capability !== 'text') return null;
  return {
    keyId: key.id,
    modelId: model.id,
    baseUrl: key.baseUrl,
    apiKey: key.apiKey,
  };
}
