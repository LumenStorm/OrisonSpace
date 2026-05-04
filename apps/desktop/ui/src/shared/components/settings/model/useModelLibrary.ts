import { useEffect, useMemo, useState } from 'react';
import type { ModelConfig, ModelProfile, ModelType } from '@orison/shared-contracts';
import { loadProviderModels, type RemoteModel } from '../../../api/generation';
import { useAppStore } from '../../../store/appStore';
import {
  draftToProfile,
  emptyProfileDraft,
  isProfileDirty,
  nextProfileId,
  profileToDraft,
  type ProfileDraft,
} from './utils';

export type ModelLibraryState = {
  draft: ProfileDraft;
  selectedProfile: ModelProfile | null;
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
  startNewProfile: () => void;
  selectProfile: (profile: ModelProfile) => void;
  applyDraft: () => Promise<void>;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  updateSelected: (type: ModelType, profileId: string | null) => Promise<void>;
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

  // When the underlying profile is removed externally, fall back to a fresh empty draft.
  useEffect(() => {
    if (draft.id && !profiles.some((profile) => profile.id === draft.id)) {
      setDraft(emptyProfileDraft());
      setRemoteModels([]);
      setRefreshError(null);
    }
  }, [profiles, draft.id]);

  function updateDraft(values: Partial<ProfileDraft>) {
    if ('provider' in values && values.provider !== draft.provider) {
      setNotice(t('settings.providerSwitchedReset'));
      setRemoteModels([]);
    }
    setDraft((current) => ({ ...current, ...values }));
  }

  function resetEditorState() {
    setRemoteModels([]);
    setRefreshError(null);
    setNotice(null);
  }

  function startNewProfile() {
    setDraft(emptyProfileDraft());
    resetEditorState();
  }

  function selectProfile(profile: ModelProfile) {
    setDraft(profileToDraft(profile));
    resetEditorState();
  }

  async function applyDraft() {
    if (!draft.model.trim()) return;
    const id = draft.id ?? nextProfileId(profiles);
    const profile = draftToProfile(draft, id);
    const exists = profiles.some((item) => item.id === id);
    const nextProfiles = exists
      ? profiles.map((item) => (item.id === id ? profile : item))
      : [...profiles, profile];

    await setModelConfig({ profiles: nextProfiles, selected: modelConfig.selected });
    setDraft(profileToDraft(profile));
    appendOutputEntry({
      scope: 'model',
      level: 'success',
      message: exists ? 'Updated model profile' : 'Added model profile',
      detail: `${profile.provider} · ${profile.model}`,
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
        novel: modelConfig.selected.novel === id ? null : modelConfig.selected.novel,
        image: modelConfig.selected.image === id ? null : modelConfig.selected.image,
        video: modelConfig.selected.video === id ? null : modelConfig.selected.video,
      },
    };
    await setModelConfig(next);
    setPendingDeleteId(null);
    if (draft.id === id) {
      setDraft(emptyProfileDraft());
      setRemoteModels([]);
      setRefreshError(null);
    }
    appendOutputEntry({ scope: 'model', level: 'info', message: 'Deleted model profile', detail: id });
  }

  async function updateSelected(type: ModelType, profileId: string | null) {
    await setModelConfig({
      profiles,
      selected: { ...modelConfig.selected, [type]: profileId },
    });
  }

  async function refreshModels() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const models = await loadProviderModels({
        provider: draft.provider,
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
      });
      appendOutputEntry({
        scope: 'model',
        level: 'success',
        message: `Fetched ${models.length} model${models.length === 1 ? '' : 's'}`,
        detail: `${draft.provider} ${draft.baseUrl}`,
      });
      setRemoteModels(models);
      const first = models[0];
      if (!draft.model && first) {
        setDraft((current) => ({
          ...current,
          model: first.id,
          capabilities: first.capabilities,
          name: current.name || first.id,
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
    dirty,
    remoteModels,
    refreshing,
    refreshError,
    notice,
    pendingDeleteId,
    pendingDeleteProfile,
    updateDraft,
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
