import { useEffect, useMemo, useState } from 'react';
import { inferApiFormat } from '@orison/model-protocols';
import type {
  ModelApiFormat,
  ModelCapability,
  ModelConfig,
  ModelProfile,
  ModelType,
  SlotAssignment,
} from '@orison/shared-contracts';
import { loadProviderModels, type RemoteModel } from '../../../api/generation';
import { useAppStore } from '../../../store/appStore';
import {
  draftToProfile,
  emptyProfileDraft,
  inferProviderFromUrl,
  isProfileDirty,
  nextProfileId,
  profileToDraft,
  type ProfileDraft,
  type ProfileDraftModel,
} from './utils';

export type ModelLibraryState = {
  draft: ProfileDraft;
  selectedProfile: ModelProfile | null;
  editorMode: 'idle' | 'creating' | 'editing';
  dirty: boolean;
  remoteModels: RemoteModel[];
  refreshing: boolean;
  refreshError: string | null;
  notice: string | null;
  pendingDeleteId: string | null;
  pendingDeleteProfile: ModelProfile | null;
};

export type ModelLibraryActions = {
  updateDraft: (values: Partial<ProfileDraft>) => void;
  updateModelEntry: (index: number, values: Partial<ProfileDraftModel>) => void;
  removeModelEntry: (index: number) => void;
  startNewProfile: () => void;
  selectProfile: (profile: ModelProfile) => void;
  applyDraft: () => Promise<void>;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  updateSelected: (type: ModelType, slot: SlotAssignment | null) => Promise<void>;
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
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfileDraft());
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'idle' | 'creating' | 'editing'>('idle');

  const profiles = modelConfig.profiles;

  const selectedProfile = useMemo(
    () => (draft.id ? profiles.find((profile) => profile.id === draft.id) ?? null : null),
    [profiles, draft.id],
  );
  const dirty = isProfileDirty(draft, selectedProfile ?? undefined);
  const pendingDeleteProfile = useMemo(
    () => (pendingDeleteId ? profiles.find((profile) => profile.id === pendingDeleteId) ?? null : null),
    [pendingDeleteId, profiles],
  );

  useEffect(() => {
    if (draft.id && !profiles.some((profile) => profile.id === draft.id)) {
      setDraft(emptyProfileDraft());
      setEditorMode('idle');
      setRemoteModels([]);
      setRefreshError(null);
    }
  }, [profiles, draft.id]);

  function updateDraft(values: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function updateModelEntry(index: number, values: Partial<ProfileDraftModel>) {
    setDraft((current) => ({
      ...current,
      models: current.models.map((entry, idx) => (idx === index ? { ...entry, ...values } : entry)),
    }));
  }

  function removeModelEntry(index: number) {
    setDraft((current) => ({
      ...current,
      models: current.models.filter((_, idx) => idx !== index),
    }));
  }

  function resetEditorState() {
    setRemoteModels([]);
    setRefreshError(null);
    setNotice(null);
  }

  function startNewProfile() {
    setDraft(emptyProfileDraft());
    setEditorMode('creating');
    resetEditorState();
  }

  function selectProfile(profile: ModelProfile) {
    setDraft(profileToDraft(profile));
    setEditorMode('editing');
    resetEditorState();
  }

  async function applyDraft() {
    if (draft.models.length === 0) return;
    const id = draft.id ?? nextProfileId(profiles);
    const profile = draftToProfile(draft, id);
    const exists = profiles.some((item) => item.id === id);
    const nextProfiles = exists
      ? profiles.map((item) => (item.id === id ? profile : item))
      : [...profiles, profile];

    await setModelConfig({ profiles: nextProfiles, selected: modelConfig.selected });
    setDraft(profileToDraft(profile));
    setEditorMode('editing');
    appendOutputEntry({
      scope: 'model',
      level: 'success',
      message: exists ? 'Updated model profile' : 'Added model profile',
      detail: `${profile.provider} · ${profile.models.length} model(s)`,
    });
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    const next: ModelConfig = {
      profiles: profiles.filter((profile) => profile.id !== id),
      selected: {
        novel: modelConfig.selected.novel?.profileId === id ? null : modelConfig.selected.novel,
        image: modelConfig.selected.image?.profileId === id ? null : modelConfig.selected.image,
        video: modelConfig.selected.video?.profileId === id ? null : modelConfig.selected.video,
      },
    };
    await setModelConfig(next);
    setPendingDeleteId(null);
    if (draft.id === id) {
      setDraft(emptyProfileDraft());
      setEditorMode('idle');
      setRemoteModels([]);
      setRefreshError(null);
    }
    appendOutputEntry({ scope: 'model', level: 'info', message: 'Deleted model profile', detail: id });
  }

  async function updateSelected(type: ModelType, slot: SlotAssignment | null) {
    await setModelConfig({
      profiles,
      selected: { ...modelConfig.selected, [type]: slot },
    });
  }

  async function refreshModels() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const provider = inferProviderFromUrl(draft.baseUrl);
      const models = await loadProviderModels({
        provider,
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
      });
      appendOutputEntry({
        scope: 'model',
        level: 'success',
        message: `Fetched ${models.length} model${models.length === 1 ? '' : 's'}`,
        detail: `${provider} ${draft.baseUrl}`,
      });
      setRemoteModels(models);
      // Pre-fill the model rows with one entry per remote id, defaulting
      // alias = id, apiFormat = inferApiFormat(id, provider), and
      // capabilities from the listing.
      if (draft.models.length === 0 && models.length > 0) {
        setDraft((current) => ({
          ...current,
          models: models.map((m) => ({
            id: m.id,
            alias: m.id,
            apiFormat: inferApiFormat(m.id, provider) as ModelApiFormat,
            capabilities: (m.capabilities.length > 0 ? m.capabilities : ['text']) as ModelCapability[],
          })),
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.refreshFailed');
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
    selectedProfile,
    editorMode,
    dirty,
    remoteModels,
    refreshing,
    refreshError,
    notice,
    pendingDeleteId,
    pendingDeleteProfile,
    updateDraft,
    updateModelEntry,
    removeModelEntry,
    startNewProfile,
    selectProfile,
    applyDraft,
    requestDelete,
    cancelDelete,
    confirmDelete,
    updateSelected,
    refreshModels,
    dismissNotice,
  };
}
