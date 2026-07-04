import { useMemo, useState } from 'react';
import type {
  ApiKeyEntry,
  ModelConfig,
  RemoteModel,
} from '@orison/shared-contracts';
import { loadRemoteModels } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import {
  draftToKey,
  emptyKeyDraft,
  isKeyDirty,
  keyToDraft,
  nextKeyId,
  type KeyDraft,
  type KeyDraftModel,
} from './utils';

export type ModelLibraryState = {
  draft: KeyDraft;
  selectedKey: ApiKeyEntry | null;
  editorMode: 'idle' | 'creating' | 'editing';
  dirty: boolean;
  remoteModels: RemoteModel[];
  refreshing: boolean;
  refreshError: string | null;
  notice: string | null;
  pendingDeleteId: string | null;
  pendingDeleteKey: ApiKeyEntry | null;
};

export type ModelLibraryActions = {
  updateDraft: (values: Partial<KeyDraft>) => void;
  updateModelEntry: (index: number, values: Partial<KeyDraftModel>) => void;
  removeModelEntry: (index: number) => void;
  startNewKey: () => void;
  selectKey: (key: ApiKeyEntry) => void;
  applyDraft: () => Promise<void>;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  refreshModels: () => Promise<void>;
  dismissNotice: () => void;
};

type Args = {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => Promise<void>;
  t: (key: string) => string;
};

export function useModelLibrary({ modelConfig, setModelConfig, t }: Args): ModelLibraryState & ModelLibraryActions {
  const appendOutputEntry = useAppStore((s) => s.appendOutputEntry);
  const [draft, setDraft] = useState<KeyDraft>(emptyKeyDraft());
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'idle' | 'creating' | 'editing'>('idle');

  const keys = modelConfig.keys;

  const selectedKey = useMemo(
    () => (draft.id ? keys.find((k) => k.id === draft.id) ?? null : null),
    [keys, draft.id],
  );
  const dirty = isKeyDirty(draft, selectedKey ?? undefined);
  const pendingDeleteKey = useMemo(
    () => (pendingDeleteId ? keys.find((k) => k.id === pendingDeleteId) ?? null : null),
    [pendingDeleteId, keys],
  );

  function updateDraft(values: Partial<KeyDraft>) {
    setDraft((prev) => ({ ...prev, ...values }));
  }

  function updateModelEntry(index: number, values: Partial<KeyDraftModel>) {
    setDraft((prev) => {
      const models = [...prev.models];
      models[index] = { ...models[index]!, ...values };
      return { ...prev, models };
    });
  }

  function removeModelEntry(index: number) {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index),
    }));
  }

  function startNewKey() {
    setDraft(emptyKeyDraft());
    setEditorMode('creating');
    setRemoteModels([]);
    setRefreshError(null);
    setNotice(null);
  }

  function selectKey(key: ApiKeyEntry) {
    setDraft(keyToDraft(key));
    setEditorMode('editing');
    setRemoteModels([]);
    setRefreshError(null);
    setNotice(null);
  }

  async function applyDraft() {
    const id = draft.id ?? nextKeyId(keys);
    const newKey = draftToKey(draft, id);

    if (newKey.models.length === 0) {
      setNotice(t('settings.noModelsWarning'));
      return;
    }

    const updatedKeys = draft.id
      ? keys.map((k) => (k.id === draft.id ? newKey : k))
      : [...keys, newKey];

    await setModelConfig({ keys: updatedKeys });
    setDraft(keyToDraft(newKey));
    setEditorMode('editing');
    setNotice(null);
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const updatedKeys = keys.filter((k) => k.id !== pendingDeleteId);
    await setModelConfig({ keys: updatedKeys });
    setPendingDeleteId(null);
    if (draft.id === pendingDeleteId) {
      setDraft(emptyKeyDraft());
      setEditorMode('idle');
    }
  }

  async function refreshModels() {
    if (!draft.baseUrl || (!draft.apiKey && !draft.id)) {
      setRefreshError(t('settings.missingUrlOrKey'));
      return;
    }
    setRefreshing(true);
    setRefreshError(null);
    try {
      const models = await loadRemoteModels(draft.id && !draft.apiKey
        ? { keyId: draft.id }
        : { protocol: draft.protocol, apiKey: draft.apiKey, baseUrl: draft.baseUrl });
      setRemoteModels(models);

      // Merge into draft: add new models, keep existing enabled state
      const existingIds = new Set(draft.models.map((m) => m.id));
      const merged: KeyDraftModel[] = [...draft.models];
      for (const m of models) {
        if (!existingIds.has(m.id)) {
          merged.push({ id: m.id, alias: m.alias, capability: m.capability, enabled: true });
        }
      }
      setDraft((prev) => ({ ...prev, models: merged }));
      setNotice(t('settings.modelsRefreshed').replace('{count}', String(models.length)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendOutputEntry({
        scope: 'model',
        level: 'error',
        message: 'Model list request failed',
        detail: message,
      });
      setRefreshError(message);
    } finally {
      setRefreshing(false);
    }
  }

  function dismissNotice() {
    setNotice(null);
  }

  return {
    draft,
    selectedKey,
    editorMode,
    dirty,
    remoteModels,
    refreshing,
    refreshError,
    notice,
    pendingDeleteId,
    pendingDeleteKey,
    updateDraft,
    updateModelEntry,
    removeModelEntry,
    startNewKey,
    selectKey,
    applyDraft,
    requestDelete,
    cancelDelete,
    confirmDelete,
    refreshModels,
    dismissNotice,
  };
}
