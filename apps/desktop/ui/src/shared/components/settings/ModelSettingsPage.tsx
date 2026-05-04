import { useEffect, useMemo, useState } from 'react';
import type {
  GenerationProvider,
  ModelCapability,
  ModelConfig,
  ModelProfile,
  ModelType,
} from '@orison/shared-contracts';
import { loadProviderModels, type RemoteModel } from '../../api/generation';
import { useAppStore } from '../../store/appStore';

type Props = {
  t: (key: string) => string;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => Promise<void>;
};

type ProfileDraft = {
  id: string | null;
  name: string;
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities: ModelCapability[];
};

const MODEL_TYPES: Array<{ id: ModelType; labelKey: string; capability: ModelCapability }> = [
  { id: 'novel', labelKey: 'settings.novelModel', capability: 'text' },
  { id: 'image', labelKey: 'settings.imageModel', capability: 'image' },
  { id: 'video', labelKey: 'settings.videoModel', capability: 'video' },
];

const PROVIDERS: GenerationProvider[] = ['openai', 'gcp', 'anthropic'];
const DEFAULT_DRAFT: ProfileDraft = {
  id: null,
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  capabilities: ['text'],
};

export function ModelSettingsPage({ t, modelConfig, setModelConfig }: Props) {
  const appendOutputEntry = useAppStore((s) => s.appendOutputEntry);
  const [draft, setDraft] = useState<ModelConfig>(normalizeConfig(modelConfig));
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(normalizeConfig(modelConfig));
  }, [modelConfig]);

  const sortedProfiles = draft.profiles;
  const availableRemoteModels = useMemo(() => {
    const merged = new Set(remoteModels.map((model) => model.id));
    if (profileDraft.model) merged.add(profileDraft.model);
    return [...merged];
  }, [remoteModels, profileDraft.model]);

  function updateProfileDraft(values: Partial<ProfileDraft>) {
    setProfileDraft((current) => ({ ...current, ...values }));
    setSaved(false);
  }

  function startEdit(profile: ModelProfile) {
    setProfileDraft({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      apiKey: profile.apiKey,
      baseUrl: profile.baseUrl,
      model: profile.model,
      capabilities: profile.capabilities,
    });
    setRemoteModels([]);
    setRefreshError(null);
    setSaved(false);
  }

  function resetProfileDraft() {
    setProfileDraft(DEFAULT_DRAFT);
    setRemoteModels([]);
    setRefreshError(null);
    setSaved(false);
  }

  async function handleRefreshModels() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const models = await loadProviderModels({
        provider: profileDraft.provider,
        apiKey: profileDraft.apiKey,
        baseUrl: profileDraft.baseUrl,
      });
      appendOutputEntry({
        scope: 'model',
        level: 'success',
        message: `Fetched ${models.length} model${models.length === 1 ? '' : 's'}`,
        detail: `${profileDraft.provider} ${profileDraft.baseUrl}`,
      });
      setRemoteModels(models);
      const first = models[0];
      if (!profileDraft.model && first) {
        setProfileDraft((current) => ({
          ...current,
          model: first.id,
          capabilities: first.capabilities,
          name: current.name || first.id,
        }));
      }
    } catch (error) {
      appendOutputEntry({
        scope: 'model',
        level: 'error',
        message: 'Model list request failed',
        detail: error instanceof Error ? error.message : t('settings.refreshFailed'),
      });
      setRefreshError(error instanceof Error ? error.message : t('settings.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }

  function handleModelChoice(modelId: string) {
    const remote = remoteModels.find((item) => item.id === modelId);
    updateProfileDraft({
      model: modelId,
      capabilities: remote?.capabilities ?? profileDraft.capabilities,
      name: profileDraft.name || modelId,
    });
  }

  function upsertProfile() {
    if (!profileDraft.model.trim()) return;
    const id = profileDraft.id ?? nextProfileId(draft.profiles);
    const profile: ModelProfile = {
      id,
      name: profileDraft.name.trim() || profileDraft.model.trim(),
      provider: profileDraft.provider,
      apiKey: profileDraft.apiKey,
      baseUrl: profileDraft.baseUrl,
      model: profileDraft.model.trim(),
      capabilities: profileDraft.capabilities.length > 0 ? profileDraft.capabilities : ['text'],
    };

    setDraft((current) => {
      const exists = current.profiles.some((item) => item.id === id);
      return {
        ...current,
        profiles: exists
          ? current.profiles.map((item) => item.id === id ? profile : item)
          : [...current.profiles, profile],
      };
    });
    setProfileDraft({ ...profile, id });
    setSaved(false);
  }

  function deleteProfile(id: string) {
    setDraft((current) => ({
      profiles: current.profiles.filter((profile) => profile.id !== id),
      selected: {
        novel: current.selected.novel === id ? null : current.selected.novel,
        image: current.selected.image === id ? null : current.selected.image,
        video: current.selected.video === id ? null : current.selected.video,
      },
    }));
    if (profileDraft.id === id) resetProfileDraft();
    setSaved(false);
  }

  function updateSelected(type: ModelType, profileId: string) {
    setDraft((current) => ({
      ...current,
      selected: {
        ...current.selected,
        [type]: profileId || null,
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setModelConfig(normalizeConfig(draft));
      appendOutputEntry({
        scope: 'model',
        level: 'success',
        message: 'Saved model configuration',
        detail: `${draft.profiles.length} profile${draft.profiles.length === 1 ? '' : 's'}`,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page model-library-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.modelConfig')}</h3>
      </div>

      <div className="model-library-layout">
        <section className="model-library-list" aria-label={t('settings.modelList')}>
          <div className="model-library-toolbar">
            <span className="sidebar-settings-label">{t('settings.modelList')}</span>
            <button type="button" className="settings-refresh-button" onClick={resetProfileDraft} aria-label="Add model">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
          <div className="model-profile-list">
            {sortedProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`model-profile-row${profileDraft.id === profile.id ? ' is-active' : ''}`}
                onClick={() => startEdit(profile)}
              >
                <span className="model-profile-name">{profile.name}</span>
                <span className="model-profile-meta">{profile.provider} · {profile.model}</span>
              </button>
            ))}
            {sortedProfiles.length === 0 ? (
              <span className="sidebar-settings-hint">{t('settings.modelSelectPlaceholder')}</span>
            ) : null}
          </div>
        </section>

        <section className="model-profile-editor" aria-label={t('settings.modelDetails')}>
          <span className="sidebar-settings-label">{t('settings.modelDetails')}</span>

          <label className="sidebar-settings-input-row">
            <span className="sidebar-settings-input-label">{t('settings.modelName')}</span>
            <input
              className="sidebar-settings-input"
              value={profileDraft.name}
              placeholder={profileDraft.model || t('settings.modelNamePlaceholder')}
              onChange={(event) => updateProfileDraft({ name: event.target.value })}
            />
          </label>

          <label className="sidebar-settings-input-row">
            <span className="sidebar-settings-input-label">{t('settings.provider')}</span>
            <select
              className="sidebar-settings-input"
              value={profileDraft.provider}
              onChange={(event) => updateProfileDraft({
                provider: event.target.value as GenerationProvider,
                model: '',
                capabilities: ['text'],
              })}
            >
              {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </label>

          <label className="sidebar-settings-input-row">
            <span className="sidebar-settings-input-label">{t('settings.apiKey')}</span>
            <div className="sidebar-settings-input-wrap settings-refresh-row">
              <input
                className="sidebar-settings-input"
                type={showApiKey ? 'text' : 'password'}
                value={profileDraft.apiKey}
                placeholder={t('settings.apiKeyPlaceholder')}
                onChange={(event) => updateProfileDraft({ apiKey: event.target.value })}
              />
              <button
                type="button"
                className="sidebar-settings-input-toggle"
                onClick={() => setShowApiKey((value) => !value)}
                aria-label={showApiKey ? t('settings.hideKey') : t('settings.showKey')}
              >
                <span className="material-symbols-outlined">{showApiKey ? 'visibility_off' : 'visibility'}</span>
              </button>
              <button
                type="button"
                className="settings-refresh-button"
                onClick={() => void handleRefreshModels()}
                disabled={refreshing}
                aria-label={t('settings.refreshModels')}
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </label>

          <label className="sidebar-settings-input-row">
            <span className="sidebar-settings-input-label">{t('settings.baseUrl')}</span>
            <input
              className="sidebar-settings-input"
              value={profileDraft.baseUrl}
              placeholder={t('settings.baseUrlPlaceholder')}
              onChange={(event) => updateProfileDraft({ baseUrl: event.target.value })}
            />
            {refreshError ? <span className="sidebar-settings-hint">{refreshError}</span> : null}
          </label>

          <label className="sidebar-settings-input-row">
            <span className="sidebar-settings-input-label">{t('settings.modelName')}</span>
            <select
              className="sidebar-settings-input"
              value={profileDraft.model}
              onChange={(event) => handleModelChoice(event.target.value)}
            >
              <option value="">{t('settings.modelSelectPlaceholder')}</option>
              {availableRemoteModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>

          <div className="model-capability-row" aria-label="Capabilities">
            {(['text', 'image', 'video'] as const).map((capability) => (
              <label key={capability} className="model-capability-option">
                <input
                  type="checkbox"
                  checked={profileDraft.capabilities.includes(capability)}
                  onChange={(event) => updateProfileDraft({
                    capabilities: toggleCapability(profileDraft.capabilities, capability, event.target.checked),
                  })}
                />
                <span>{capability}</span>
              </label>
            ))}
          </div>

          <div className="model-editor-actions">
            {profileDraft.id ? (
              <button type="button" className="settings-danger-button" onClick={() => deleteProfile(profileDraft.id!)}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            ) : null}
            <button type="button" className="settings-save-button" onClick={upsertProfile} disabled={!profileDraft.model.trim()}>
              {profileDraft.id ? t('settings.save') : t('settings.addModel')}
            </button>
          </div>
        </section>
      </div>

      <section className="model-assignment-panel" aria-label={t('settings.modelType')}>
        <span className="sidebar-settings-label">{t('settings.modelType')}</span>
        <div className="model-assignment-grid">
          {MODEL_TYPES.map((type) => (
            <label key={type.id} className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t(type.labelKey)}</span>
              <select
                className="sidebar-settings-input"
                value={draft.selected[type.id] ?? ''}
                onChange={(event) => updateSelected(type.id, event.target.value)}
              >
                <option value="">{t('settings.modelSelectPlaceholder')}</option>
                {sortedProfiles
                  .filter((profile) => profile.capabilities.includes(type.capability))
                  .map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <div className="settings-page-actions">
        <span className="sidebar-settings-hint">{saved ? t('settings.saved') : ''}</span>
        <button type="button" className="settings-save-button" onClick={handleSave} disabled={saving}>
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}

function normalizeConfig(config: ModelConfig): ModelConfig {
  const profileIds = new Set((config.profiles ?? []).map((profile) => profile.id));
  return {
    profiles: config.profiles ?? [],
    selected: {
      novel: profileIds.has(config.selected?.novel ?? '') ? config.selected.novel : null,
      image: profileIds.has(config.selected?.image ?? '') ? config.selected.image : null,
      video: profileIds.has(config.selected?.video ?? '') ? config.selected.video : null,
    },
  };
}

function nextProfileId(profiles: ModelProfile[]): string {
  const existing = new Set(profiles.map((profile) => profile.id));
  let index = 1;
  while (existing.has(`model_${String(index).padStart(3, '0')}`)) index += 1;
  return `model_${String(index).padStart(3, '0')}`;
}

function toggleCapability(
  capabilities: ModelCapability[],
  capability: ModelCapability,
  enabled: boolean,
): ModelCapability[] {
  const next = new Set(capabilities);
  if (enabled) next.add(capability);
  else next.delete(capability);
  return [...next];
}
